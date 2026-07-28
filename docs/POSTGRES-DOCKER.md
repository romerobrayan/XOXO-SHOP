# Postgres local con Docker

Guía paso a paso para levantar la base de datos de SECRETO en tu máquina. Al
terminar vas a tener el esquema completo aplicado y el catálogo de demostración
cargado, con la tienda leyendo de Postgres en vez de los fixtures.

El proyecto corre **con base de datos o sin ella**: si `DATABASE_URL` no está
definida, cada consulta del catálogo cae a `src/features/catalog/fixtures.ts` y
la tienda funciona igual. Esta guía es para cuando necesitás la base real —
migraciones, seed, panel admin, órdenes.

**Antes de empezar:** `npm install` tiene que haber corrido al menos una vez. El
`postinstall` ejecuta `prisma generate`, que escribe el cliente en
`src/generated/prisma/`; sin eso el seed no compila.

---

## Paso 1 — Confirmar Docker y la imagen

```bash
docker version                # el demonio tiene que estar corriendo
docker image ls postgres      # qué tag descargaste
```

Si `docker version` falla en la parte de *Server*, abrí Docker Desktop (macOS y
Windows) o arrancá el servicio (`sudo systemctl start docker` en Linux) antes de
seguir.

Anotá el tag que te aparece en `docker image ls`. El `docker-compose.yml` de
este repo pide `postgres:18-alpine`; si vos bajaste otro — `postgres:17`,
`postgres:latest`, lo que sea — cambiá esa línea del compose por tu tag y no
descargás nada nuevo. **Cualquier Postgres 14 o superior corre este esquema.**

---

## Paso 2 — Levantar el contenedor

### Opción A — Docker Compose (recomendada)

El repo ya trae `docker-compose.yml` en la raíz. Desde la raíz del proyecto:

```bash
docker compose up -d --wait
```

`-d` lo deja en segundo plano y `--wait` bloquea hasta que el *healthcheck*
pase, así no corrés `prisma migrate` contra un Postgres que todavía está
arrancando — que es la causa número uno del error `P1001`.

Esto crea el contenedor `secreto-postgres` con:

| | |
| --- | --- |
| Usuario | `secreto` |
| Contraseña | `secreto` |
| Base de datos | `secreto_dev` |
| Puerto en tu máquina | `5432` |
| Volumen | `secreto_pgdata` (los datos sobreviven a reinicios del contenedor) |

Son credenciales de desarrollo a propósito: esta base solo tiene catálogo de
demostración y solo escucha en tu máquina.

### Opción B — Un solo `docker run`

Si preferís no usar compose, el equivalente exacto:

```bash
docker run -d \
  --name secreto-postgres \
  -e POSTGRES_USER=secreto \
  -e POSTGRES_PASSWORD=secreto \
  -e POSTGRES_DB=secreto_dev \
  -p 5432:5432 \
  -v secreto_pgdata:/var/lib/postgresql/data \
  --restart unless-stopped \
  postgres:18-alpine
```

El `-v` no es opcional: sin volumen nombrado, `docker rm` se lleva la base
entera. En el resto de la guía, donde diga `docker compose exec db`, con esta
opción usás `docker exec secreto-postgres`.

---

## Paso 3 — Comprobar que responde

```bash
docker compose ps                       # STATUS debe decir "healthy"
docker compose logs db | tail -5        # "database system is ready to accept connections"
docker compose exec db psql -U secreto -d secreto_dev -c "select version();"
```

Si el tercer comando imprime la versión de Postgres, la base está lista y
accesible. Si no, saltá a "Errores comunes" al final.

---

## Paso 4 — Configurar `.env`

```bash
cp .env.example .env
```

Y en `.env` dejá la línea de la base así:

```
DATABASE_URL="postgresql://secreto:secreto@localhost:5432/secreto_dev?schema=public"
```

Es exactamente el usuario, contraseña, base y puerto del paso 2. Si cambiaste el
puerto del host a `5433`, cambialo también acá.

`.env` está en `.gitignore` (`.env*` con la excepción `!.env.example`), así que
no se sube. Esta variable la leen dos lugares: `prisma.config.ts` para la CLI
—`migrate`, `studio`, `seed`— y `src/lib/db.ts` a través del adaptador `pg` en
tiempo de ejecución.

---

## Paso 5 — Aplicar el esquema

```bash
npx prisma migrate dev
```

La migración inicial ya existe en `prisma/migrations/20260727232736_init/`, así
que este comando **la aplica, no crea una nueva**. Vas a ver algo como
`1 migration found` y después `Your database is now in sync with your schema`.

Comprobalo:

```bash
docker compose exec db psql -U secreto -d secreto_dev -c "\dt"
```

Deben aparecer las 15 tablas del modelo: `Brand`, `Category`, `Product`,
`ProductOption`, `ProductOptionValue`, `ProductVariant`, `VariantOptionValue`,
`ProductSpec`, `ProductMedia`, `InventoryMovement`, `Customer`, `Address`,
`Order`, `OrderItem`, `Payment` — más `_prisma_migrations`.

De aquí en adelante, **cada vez que toques `prisma/schema.prisma` corré
`npx prisma migrate dev`** y commiteá la carpeta de migración que genera. Nunca
edites a mano una migración ya aplicada.

---

## Paso 6 — Cargar el catálogo de demostración

```bash
npx prisma db seed
```

Escribe 6 productos, 14 variantes y 11 movimientos de inventario, con los mismos
IDs que sirven los fixtures. El seed borra las tablas antes de escribir —
`deleteMany` en orden de dependencias— así que es idempotente y solo se corre
contra bases de desarrollo.

Verificación rápida:

```bash
docker compose exec db psql -U secreto -d secreto_dev \
  -c 'select count(*) from "Product";' \
  -c 'select count(*) from "ProductVariant";'
```

Los productos de demostración se declaran **una sola vez**, en
`src/features/catalog/demo-catalog.ts`. Agregar productos ahí, nunca en
`prisma/seed.ts` ni en `fixtures.ts`, y volver a correr el seed.

---

## Paso 7 — Verificar de punta a punta

```bash
npm run test     # la suite de paridad fixtures ↔ Postgres corre porque DATABASE_URL existe
npx prisma studio    # inspector visual en http://localhost:5555
npm run dev          # la tienda en http://localhost:3000, ahora leyendo de Postgres
```

`npm run test` es la comprobación que importa: `parity.test.ts` compara las dos
fuentes de datos a través de los mappers reales y falla si divergen. Sin
`DATABASE_URL` esas seis pruebas se saltan solas; con la base levantada y
sembrada tienen que pasar. Si fallan con "the catalog is empty", te faltó el
paso 6.

---

## Uso diario

```bash
docker compose start     # arrancar la base al empezar a trabajar
docker compose stop      # apagarla al terminar (los datos quedan)
docker compose ps        # ¿está corriendo?
docker compose logs -f db
```

Una vez creado el contenedor no repetís los pasos 4 a 6; `start` y `stop` es
todo el ciclo normal.

---

## Resetear y borrar

Tres niveles, de menos a más destructivo:

```bash
npx prisma migrate reset   # borra el esquema, reaplica migraciones y RE-SIEMBRA solo
docker compose down        # elimina el contenedor, CONSERVA el volumen
docker compose down -v     # elimina el contenedor Y BORRA los datos
```

`migrate reset` corre el seed automáticamente (está configurado en
`prisma.config.ts`, en `migrations.seed`), así que es la forma más rápida de
volver a un estado limpio. Después de `down -v` hay que rehacer los pasos 2, 5
y 6.

---

## Copias de seguridad

```bash
# exportar
docker compose exec -T db pg_dump -U secreto secreto_dev > backup.sql

# restaurar
cat backup.sql | docker compose exec -T db psql -U secreto -d secreto_dev
```

El `-T` es necesario: sin él Docker asigna una TTY y te corrompe el archivo.

---

## Errores comunes

**`P1001: Can't reach database server at localhost:5432`**
El contenedor no está arriba o todavía no terminó de arrancar. `docker compose ps`
y mirá que diga `healthy`. Si acabás de levantarlo, usá
`docker compose up -d --wait` en vez de `up -d`.

**`Bind for 0.0.0.0:5432 failed: port is already allocated`**
Ya tenés un Postgres escuchando en ese puerto — instalado nativamente o de otro
proyecto. Cambiá el puerto del host en `docker-compose.yml` a `"5433:5432"`,
volvé a levantar, y actualizá `DATABASE_URL` a `...@localhost:5433/...`.

**`password authentication failed for user "secreto"`**
Casi siempre esto: `POSTGRES_USER`, `POSTGRES_PASSWORD` y `POSTGRES_DB` **solo
se aplican la primera vez que se inicializa el volumen**. Si creaste el
contenedor antes con otras credenciales y después cambiaste el compose, el
volumen viejo sigue con las viejas. Se arregla con `docker compose down -v` y
`docker compose up -d --wait` — y sí, eso borra los datos, que en desarrollo es
un `npx prisma migrate dev && npx prisma db seed` de distancia.

**`The table "public.Product" does not exist` al sembrar**
Te saltaste el paso 5. Corré `npx prisma migrate dev` primero.

**`DATABASE_URL is not set` al sembrar**
Falta `.env` en la raíz, o estás corriendo el comando desde otra carpeta. El
mensaje lo lanza el propio seed a propósito.

**`P3014: Prisma Migrate could not create the shadow database`**
`prisma migrate dev` crea y borra una base temporal para validar la migración, y
eso necesita permiso `CREATEDB`. El usuario del contenedor es superusuario, así
que localmente no pasa; aparece contra bases gestionadas con usuario
restringido. Ahí se usa `prisma migrate deploy`, que no necesita shadow database.

**`Cannot find module '../src/generated/prisma/client'`**
No corriste `npm install` (o falló el `postinstall`). `npx prisma generate` lo
arregla.

---

## Qué NO hace esta configuración

Este compose es solo para desarrollo local. Producción va a una base gestionada
—Neon o Supabase— con `?sslmode=require` en la URL, como documenta
`.env.example`. No hay un servicio de la app en el compose porque `npm run dev`
corre en la máquina, no en un contenedor: por eso `localhost` en `DATABASE_URL`
funciona. Si algún día la app se contenedoriza, esa URL pasa a apuntar a `db`,
el nombre del servicio.
