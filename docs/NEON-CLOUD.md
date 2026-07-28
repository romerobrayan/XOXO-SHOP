# Base de datos en la nube — Neon

Guía de la base **principal** del proyecto. Neon es una Postgres gestionada: no
depende de que tengas Docker abierto ni de estar en la misma máquina, que es
justo lo que necesitábamos — la sesión local no está disponible 24/7.

El Postgres local con Docker sigue existiendo y sigue siendo útil, pero pasó a
ser secundario. Ver "Las dos bases y para qué sirve cada una" más abajo, y
`docs/POSTGRES-DOCKER.md` para levantarlo.

---

## 1. Qué hay montado

| | |
| --- | --- |
| Proveedor | Neon (AWS `us-east-2`, Ohio) |
| Versión | PostgreSQL 18.4 |
| Base | `neondb` |
| Usuario | `neondb_owner` |
| Esquema | 16 tablas — las 15 del modelo + `_prisma_migrations` |
| Datos | Catálogo de demostración: 6 productos, 14 variantes, 11 movimientos |

Verificado de punta a punta: `prisma migrate deploy` aplicó la migración inicial,
`prisma db seed` escribió el catálogo, y las 15 pruebas de `parity.test.ts`
—incluidas las 6 que comparan fixtures contra Postgres— pasan contra Neon.

---

## 2. Los dos endpoints

Neon da **dos** cadenas de conexión al mismo dato. La diferencia importa y es
fácil de pasar por alto porque solo cambia el nombre del host:

```
directo   ep-XXXXXXXX.c-4.us-east-2.aws.neon.tech
pooled    ep-XXXXXXXX-pooler.c-4.us-east-2.aws.neon.tech
                     ^^^^^^^
```

**Directo** — una conexión real a Postgres. Es la que necesitan las migraciones
y cualquier DDL, porque el pooler en modo transacción rompe los *advisory locks*
que Prisma usa para no aplicar dos migraciones a la vez.

**Pooled** — pasa por un pool de conexiones. Es la que necesita un entorno
serverless como Vercel, donde cada invocación de una función puede abrir su
propia conexión y agotar el límite de la base en minutos.

La regla operativa:

| Dónde | Qué endpoint | Por qué |
| --- | --- | --- |
| Tu `.env` local | **directo** | de acá salen `migrate deploy`, `db seed`, `studio` |
| Variable de entorno en Vercel | **pooled** | solo runtime, muchas conexiones cortas |

Los dos están probados y responden.

---

## 3. Conectar desde cero

En el dashboard de Neon, *Connection string*, copiá la cadena e incluí
`?sslmode=require`. Después:

```bash
cp .env.example .env
```

Y en `.env` dejá activa la línea de Neon:

```
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@ep-XXXX.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

`.env` está en `.gitignore` (`.env*` con la excepción `!.env.example`), así que
la credencial no se sube. Esa variable la leen dos lugares: `prisma.config.ts`
para la CLI y `src/lib/db.ts` a través del adaptador `pg` en tiempo de ejecución.

Aplicar el esquema y cargar el catálogo:

```bash
npx prisma migrate deploy
npx prisma db seed
npm run test
```

**`migrate deploy`, no `migrate dev`.** La diferencia es el punto 4.

---

## 4. El flujo de migraciones, que ahora tiene dos pasos

Este es el cambio de hábito más importante de trabajar contra una base
gestionada. `prisma migrate dev` hace dos cosas: *genera* la migración
comparando el schema contra una **shadow database** que crea y destruye, y la
aplica. Contra Neon eso es a la vez innecesario y peligroso.

Cuando toques `prisma/schema.prisma`:

```bash
docker compose up -d --wait
npx prisma migrate dev --name descripcion_del_cambio
```

contra la **local**. Genera `prisma/migrations/<timestamp>_descripcion/` y la
commiteás. Después, contra **Neon**:

```bash
npx prisma migrate deploy
```

que solo aplica lo que ya existe en `prisma/migrations/`. No necesita shadow
database, no compara nada, no borra nada.

> **Nunca corras `migrate dev`, `migrate reset` ni `db push` apuntando a Neon.**
> `reset` borra todos los datos, y `db push` aplica cambios sin dejar registro
> en `_prisma_migrations`, que desincroniza el historial para todos los demás.
>
> Prisma 7 además se niega a ejecutar `migrate reset` cuando lo invoca un agente
> de IA y pide consentimiento explícito. Es el comportamiento correcto: no lo
> saltes con la variable de entorno que sugiere el mensaje.

Y el seed: `prisma/seed.ts` arranca con `deleteMany` en orden de dependencias.
Contra la base de demostración es idempotente y está bien. **El día que Neon
tenga pedidos reales, ese comando deja de ser seguro.**

---

## 5. Desplegar en Vercel

Falta hacerlo. Lo que hay que cargar en *Settings → Environment Variables* del
proyecto:

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | la cadena **pooled**, con `?sslmode=require` |
| `PAYMENT_PROVIDER` | `mock` |

Con `DATABASE_URL` cargada, la preview deja de servir fixtures y pasa a leer de
Neon — la clienta y vos ven exactamente el mismo catálogo, y un cambio hecho
desde el panel admin se refleja en la preview sin volver a desplegar.

Si preferís que la preview siga sirviendo fixtures, simplemente no cargues
`DATABASE_URL`: `src/features/catalog/queries.ts` cae a
`src/features/catalog/fixtures.ts` cuando la variable no existe.

---

## 6. El costo real: latencia

Cada consulta cruza a Ohio. Medido en esta máquina, mismo código, mismos datos:

| | Local (Docker) | Neon |
| --- | --- | --- |
| Render de `/tienda` | 192 ms | **1770 ms** |
| Prueba de paridad más lenta | 89 ms | **2201 ms** |

Unas 9× más lento. Para desarrollo iterativo la local sigue siendo mejor
experiencia; Neon gana en que está siempre disponible y es la misma base que ve
el despliegue.

Sumale que en el plan gratuito Neon **suspende el proyecto tras unos minutos de
inactividad**: la primera consulta después de una pausa paga un arranque en frío
de varios cientos de milisegundos. No es un error, es el plan.

---

## 7. Las dos bases y para qué sirve cada una

No es redundancia — cada una hace algo que la otra no puede.

| | Neon | Local (Docker) |
| --- | --- | --- |
| Disponible sin tu máquina | ✅ | ❌ |
| La misma base que ve Vercel | ✅ | ❌ |
| Rápida para iterar | ❌ | ✅ |
| Funciona sin internet | ❌ | ✅ |
| Se puede resetear sin miedo | ❌ | ✅ |
| Genera migraciones (`migrate dev`) | ❌ | ✅ |

Cambiar entre las dos es mover un `#` en `.env` y reiniciar `npm run dev`. Las
dos líneas están escritas ahí, una comentada.

---

## 8. Errores comunes

**`P1001: Can't reach database server`**
Casi siempre es el proyecto suspendido despertando, o falta `?sslmode=require`.
Reintentá una vez antes de investigar.

**`prisma migrate dev` se queja de la shadow database (`P3014`)**
Estás corriendo `migrate dev` contra Neon. Ver el punto 4: `migrate dev` va
contra la local, `migrate deploy` contra Neon.

**`SECURITY WARNING: The SSL modes 'prefer', 'require' and 'verify-ca' are treated as aliases for 'verify-full'`**
Aviso del driver `pg`, no un error. Hoy `require` se comporta como
`verify-full`; en `pg` v9 va a pasar a la semántica de libpq, que es más débil.
Para conservar el comportamiento actual, dejalo explícito en la URL:
`?sslmode=verify-full`.

**Las 6 pruebas de paridad fallan con "the catalog is empty"**
Falta `npx prisma db seed` contra Neon.

**Se filtró la contraseña**
Dashboard de Neon → *Roles* → resetear la contraseña de `neondb_owner`, y
actualizar `.env`. La cadena vieja deja de funcionar al instante.

---

## 9. Copias de seguridad

Neon hace *point-in-time restore* dentro de la ventana de retención del plan, y
permite crear una rama de la base a partir de un instante pasado. Para un volcado
propio, con el contenedor local levantado:

```bash
docker compose exec -T db pg_dump "TU_CADENA_DE_NEON" > backup.sql
```

El `-T` no es opcional: sin él Docker asigna una TTY y corrompe el archivo.
