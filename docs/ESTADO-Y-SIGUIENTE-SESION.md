# Estado del proyecto y siguiente sesión

Documento vivo. Se actualiza al final de cada sesión de trabajo: qué quedó hecho, qué
quedó abierto y qué sigue. Si vas a retomar el proyecto, **lee esto primero y después
`CLAUDE.md`**.

**Última actualización:** 29 de julio de 2026 — sesión "Infraestructura de datos en la nube"
y su remate: CI, `revalidate` de la home y guardarraíl del seed.

---

## 1. Dónde estamos

| Fase | Estado |
| --- | --- |
| **0 — Diseño** | **Implementada.** Age gate, Home, Catálogo, Producto y Checkout (3 pasos) según el handoff SECRETO. Falta la aprobación de la clienta |
| **1 — Catálogo** | **En curso.** Esquema, primera migración y seed listos. Falta el CRUD del panel admin |
| **2 — Carrito y checkout** | No empezada. El checkout actual es solo UI: no escribe `Order` ni reserva stock |
| **3 — Pagos** | No empezada. Existen el puerto `PaymentProvider` y `MockProvider`; los adaptadores esperan cuenta de comercio |
| **4 — Admin y lanzamiento** | No empezada |

Lo que ya funciona de punta a punta: navegar el catálogo, filtrar por categoría y marca,
ordenar, abrir un producto, elegir opciones con estados de agotado correctos, agregar a la
bolsa y recorrer los tres pasos del checkout. Todo eso corre **con base de datos o sin
ella**, sirviendo exactamente los mismos DTOs.

---

## 2. Cómo se corre

```bash
npm install                  # postinstall corre `prisma generate`
npm run dev                  # sin base de datos: el catálogo sale de fixtures
```

Con base de datos — la principal es **Neon**, gestionada y siempre disponible
(`docs/NEON-CLOUD.md`):

```bash
cp .env.example .env         # DATABASE_URL = la cadena de Neon, ?sslmode=require
npx prisma migrate deploy    # aplica prisma/migrations — NO migrate dev
npx prisma db seed           # 6 productos, 14 variantes, 11 movimientos de inventario
npm run test                 # incluye la paridad fixtures ↔ Postgres
```

La Postgres local con Docker sigue disponible (`docs/POSTGRES-DOCKER.md`) para
trabajar sin internet, para iterar rápido —es ~9× más veloz que Neon— y porque
`prisma migrate dev` necesita una base descartable para **generar** migraciones.

**El flujo de migraciones quedó partido en dos:** `migrate dev` contra la local
para generar la carpeta de migración y commitearla, `migrate deploy` contra Neon
para aplicarla. Nunca `migrate dev`, `migrate reset` ni `db push` contra Neon.

El catálogo de demostración se declara **una sola vez** en
`src/features/catalog/demo-catalog.ts`. El seed lo escribe en Postgres con los mismos IDs;
`fixtures.ts` lo convierte en payloads de Prisma. `parity.test.ts` compara las dos fuentes
con los mappers reales y falla si divergen. Agregar productos de demo va ahí, no en el seed
ni en los fixtures.

---

## 3. Qué se hizo en esta sesión

**Objetivo: mover la base de datos a la nube.** La sesión local no está
disponible 24/7 y la arquitectura tiene que poder trabajar sin ella.

**La base principal es Neon.** PostgreSQL 18.4 en `us-east-2`, base `neondb`.
Esquema aplicado con `migrate deploy` (16 tablas), catálogo sembrado (6/14/11) y
las 15 pruebas de `parity.test.ts` pasando contra Neon — las 6 que comparan
fixtures contra Postgres corren de verdad, no se saltan. Comprobado por
contraste: con el Postgres local apagado y el puerto 5432 caído, `/tienda` sigue
respondiendo 200 con el catálogo completo, así que la tienda lee de Neon y no de
los fixtures.

**El despliegue quedó en Vercel.** Proyecto `secretxoxo-shop`, importado desde el
repositorio, así que cada push a `main` despliega solo y cada PR recibe su URL de
preview. `DATABASE_URL` —con el endpoint **pooled** de Neon, el que aguanta que
cada invocación serverless abra su propia conexión— y `PAYMENT_PROVIDER=mock`
cargadas en Production y Preview. Producción responde `/tienda` en 0,46–0,67 s,
bastante mejor que los ~1,8 s desde una máquina en Colombia: Vercel y Neon están
los dos en US-East.

**Remate de la sesión (29 de julio):** tres deudas saldadas en un PR chico.
CI en `.github/workflows/ci.yml` — lint, migraciones, seed, la suite completa
(las 44, paridad incluida, contra un Postgres real de servicio) y build, en cada
push y PR a `main`. `export const revalidate = 300` en la home, que estaba
prerenderizada y servía un "Top ventas" congelado al momento del build. Y el
guardarraíl del seed: se niega a correr si la base tiene pedidos, salvo
`SEED_ALLOW_ORDER_WIPE=1` — al mirar el schema resultó peor de lo anotado,
porque borrar variantes hace `SetNull` sobre `OrderItem.variantId` y el
`deleteMany` de movimientos se lleva el libro de inventario de pedidos reales:
corrupción silenciosa, sin error de FK que avise.

**Dos bugs reales encontrados al ejecutar `docs/POSTGRES-DOCKER.md` en una
máquina limpia.** Los dos estaban en `main`:

- `docker-compose.yml` montaba el volumen en `/var/lib/postgresql/data`. Desde
  Postgres 18 las imágenes oficiales guardan el clúster en un subdirectorio por
  versión mayor (`PGDATA=/var/lib/postgresql/18/docker`) y se **niegan a
  arrancar** si encuentran un volumen en la ruta vieja. El contenedor quedaba en
  `Restarting` en bucle. No era una particularidad de la imagen que había en esa
  máquina: consultando el manifiesto de `postgres:18-alpine` —el tag que el
  propio repo documenta— aparece el mismo `PGDATA` en las 8 plataformas, así que
  el compose commiteado estaba roto para cualquiera que siguiera la guía.
  Arreglado montando el directorio padre, que además es compatible con
  Postgres ≤ 17.
- La Opción B de la guía (`docker run`) repetía el mismo `-v` equivocado.

**El tag de la imagen quedó pinneado en `postgres:18-alpine`.** Un `latest`
flotante en un archivo compartido es un fallo silencioso esperando: cuando la
etiqueta pase a Postgres 19, la imagen va a buscar `.../19/docker`, no lo va a
encontrar, y va a inicializar un clúster vacío con los datos intactos pero
invisibles en `18/`. Para correr otra imagen que ya tengas local, ahora se usa
`docker-compose.override.yml`, git-ignored.

**Documentación:** `docs/NEON-CLOUD.md` nuevo — los dos endpoints de Neon
(directo para migraciones, pooled para Vercel; los dos verificados), el flujo de
migraciones partido, las variables que faltan en Vercel, la latencia medida y
los errores comunes. `docs/POSTGRES-DOCKER.md` pasó a ser la guía secundaria y
sumó el error de Postgres 18 a "Errores comunes". `README.md`, `CLAUDE.md` y
`.env.example` al día.

---

### Sesión anterior — 27 de julio de 2026

**Bloque A — sincronizar la documentación con SECRETO.**

- `docs/DESIGN_BRIEF_PDP.md` y `docs/CLAUDE_DESIGN_PLAYBOOK.md` se movieron a
  `docs/archive/` con un aviso de "SUPERSEDED" arriba y un `README.md` que explica qué
  sobrevive del contenido (la investigación de mercado) y qué murió (todo el sistema
  visual neón). Las dos citas a esos archivos en el código apuntan ahora a la nueva ruta.
- `docs/XOXO_TECHNICAL_SPEC.md` v0.3:
  - §8 reescrita completa para SECRETO — tokens marfil/vino/oro, Marcellus + Archivo,
    tesis "boutique afuera, farmacia adentro", y un aviso de que la fuente de verdad del
    diseño es `design_handoff_web_secreto/`, no el spec.
  - §6.2 ya no duplica el esquema Prisma. Describía un modelo `ProductImage` que se
    implementó como `ProductMedia`: la copia ya se había desincronizado. Ahora apunta a
    `prisma/schema.prisma` y documenta las decisiones que el archivo no puede explicar.
  - §1 explica el rebrand y qué se renombra (lo que ve el cliente) y qué no (columnas,
    repo, vocabulario interno).
  - §5 refleja el árbol real de carpetas; §4 marca qué dependencias están instaladas y
    cuáles son decisiones pendientes; §7 y §9 marcan el estado real de cada fase y sprint;
    §10 dejó de ser instrucciones de scaffolding y explica cómo se corre el proyecto hoy.
  - `middleware.ts` → `src/proxy.ts` en todas partes (Next 16 renombró la convención).
- `CLAUDE.md`: mapa de documentos arriba, `src/proxy.ts`, `ProductMedia` en vez de
  `ProductImage`, sección "Demo data" con la regla de una sola fuente, y la fase actual al
  día.
- `README.md`: tabla de dónde está cada cosa y el arranque con y sin base de datos.
- `prisma/schema.prisma`: el comentario de `orderNumber` decía `"XOXO-7F3K2M"` — un dato
  que la clienta lee en WhatsApp. Ahora dice `SECRETO-`. Solo comentarios: no hay cambio de
  esquema ni migración.

**Bloque B — habilitar la base de datos.**

- `.env.example` con `DATABASE_URL` y `PAYMENT_PROVIDER` documentados, más las variables
  que todavía no se usan (PayU, Cloudinary, Resend, better-auth) comentadas, para que la
  forma del despliegue sea visible antes de la Fase 3. `.gitignore` ignoraba `.env*`, así
  que el ejemplo nunca se habría subido: agregada la excepción `!.env.example`.
- Primera migración: `prisma/migrations/20260727232736_init/` — el modelo completo,
  generada y aplicada contra un Postgres real, no escrita a mano.
- `src/features/catalog/demo-catalog.ts`: el catálogo de demostración pasó a ser una sola
  declaración. Antes vivía duplicado en `fixtures.ts` y en `seed.ts`, con los mismos
  productos escritos dos veces.
- `prisma/seed.ts` reescrito sobre esa fuente. Escribe los IDs del catálogo tal cual, así
  que un producto tiene el mismo ID venga de donde venga. Ahora también escribe un
  `InventoryMovement` de tipo `PURCHASE` por cada variante con stock, dentro de la misma
  transacción que la crea: el stock inicial es un cambio de stock como cualquier otro y la
  regla 3 de `CLAUDE.md` no admite excepciones para datos de demo.
- `src/features/catalog/parity.test.ts`: quince pruebas. Nueve de invariantes del catálogo
  que corren siempre (IDs únicos, slugs derivados del nombre, una variante mínima por
  producto, un valor por opción y por variante, `optionKey` único, precios enteros,
  `minPriceCents` igual al mínimo real, orden determinista, cobertura de los estados que la
  tienda tiene que renderizar) y seis que comparan fixtures contra Postgres a través de los
  mappers reales — marcas, categorías, tarjetas de catálogo en orden, detalle de cada
  producto, y la conciliación del libro de inventario contra los saldos.

Verificado: `npm run build`, `npm run lint` y `npm run test` en verde, con y sin
`DATABASE_URL`. La prueba de paridad se comprobó por contraste: alterando un precio
directamente en Postgres, falla; después de `prisma db seed`, vuelve a pasar.

---

## 4. Bloques de trabajo

### Bloque A — Documentación sincronizada con SECRETO ✅ hecho

### Bloque B — Base de datos habilitada ✅ hecho

### Bloque C — Órdenes reales en el checkout

Hoy el checkout es una simulación honesta: los tres pasos existen, la bolsa vive en
Zustand y el paso 3 no escribe nada. Falta lo del servidor:

- `src/features/checkout/schemas.ts` con Zod para los datos de entrega (nombre, celular,
  departamento, ciudad, dirección, `documentType`, `documentId`) y `actions.ts` con
  `next-safe-action`.
- Crear `Order` + `OrderItem` con **snapshots** (nombre, marca, SKU, etiqueta de opciones,
  precio unitario copiados al momento de comprar).
- Reserva de stock en `prisma.$transaction` con `updateMany` condicional, más los
  movimientos `RESERVATION` / `RESERVATION_RELEASE`. El detalle está en el spec §6.4.
- Generar `orderNumber` con `nanoid`, prefijo `SECRETO-`.
- Decidir la regla de reserva para contra entrega: el spec recomienda expiración larga
  (72 h) y depende del porcentaje de no-entrega, que hay que preguntarle a la clienta.

### Bloque D — Panel admin

Es la mitad abierta de la Fase 1. `src/app/(admin)/admin/page.tsx` es un placeholder.
Necesita autenticación (`better-auth`), CRUD de productos con el sistema de opciones, y
ajuste de stock en dos toques escribiendo siempre al libro de inventario. La clienta lo va
a usar de pie en una bodega, con una mano.

### Bloque E — Fotografía y Cloudinary

Bloqueado por la clienta, no por el código. Hoy todo renderiza
`ProductImagePlaceholder` y `ProductMedia` está vacío. Cuando lleguen las fotos: sesión
sobre fondo arena `#F1E7D8` con luz cálida, 4:5, subida a Cloudinary, y el modelo ya
soporta imagen y video con `posterUrl`.

### Bloque F — Pagos

Depende de la aprobación de la cuenta de comercio, que es calendario, no código. El puerto
y el mock ya existen; el adaptador de PayU y el webhook con verificación de firma e
idempotencia entran cuando haya cuenta. Ver `docs/decisions/001-payment-provider.md`.

### Bloque G — Arquitectura en la nube 🔄 en curso

El objetivo es que nada dependa de que una máquina en particular esté prendida.
Dónde estamos:

| Pieza | Estado |
| --- | --- |
| Base de datos | ✅ **Neon**, gestionada, verificada de punta a punta |
| Repositorio | ✅ GitHub |
| Hosting | ✅ **Vercel** — `secretxoxo-shop`, importado desde el repo, con variables cargadas y leyendo de Neon |
| CI | ✅ `.github/workflows/ci.yml` — lint, migraciones, seed, suite completa y build contra un Postgres real en cada push y PR a `main` |
| Imágenes | ⬜ Cloudinary, decidido y sin implementar. Bloqueado por el Bloque E |
| Correo transaccional | ⬜ Resend, en `.env.example` y sin cablear. Fase 2 |
| Autenticación admin | ⬜ better-auth. Bloque D |

**Producción:** https://secretxoxo-shop.vercel.app — cada push a `main` despliega
solo y cada PR recibe su URL de preview. Comprobado que lee de Neon contando
lecturas sobre `Product` del lado de la base, no confiando en que responda 200:
las dos fuentes sirven contenido idéntico por diseño y el HTML no las distingue.
Detalle en `docs/NEON-CLOUD.md` §5.

Lo único que queda deliberadamente local es el Postgres de Docker, y solo porque
`prisma migrate dev` necesita una base descartable para generar migraciones.

---

## 5. Deuda abierta

| Deuda | Nota |
| --- | --- |
| `sslmode=require` sin decidir | El driver `pg` avisa que hoy `require` se comporta como `verify-full`, y que en `pg` v9 pasará a la semántica de libpq, más débil. Dejarlo explícito en `?sslmode=verify-full` es un no-op hoy y evita una degradación silenciosa mañana |
| Playwright instalado sin pruebas | `@playwright/test` está en `package.json` y no hay `playwright.config.ts` ni un solo test e2e. O se escribe el flujo de compra, o se saca la dependencia |
| El checkout no persiste | Ver Bloque C. Mientras tanto, ningún pedido hecho en la preview existe |
| Admin sin construir | Ver Bloque D |
| Sin fotos reales | Ver Bloque E. Etiquetar la preview para la clienta: las imágenes son placeholders |
| `package.json` sigue llamándose `xoxo-store` | Cosmético, sin urgencia. El repo también. Solo importa lo que ve el cliente |
| Lighthouse sin medir | El criterio de éxito del spec (≥ 90 móvil) no se ha verificado; medirlo con imágenes reales, no con placeholders |
| Descriptor de pago sin acordar | `SECRETO BTQ` es la propuesta del handoff; hay que confirmarla con la pasarela en el onboarding |

---

## 6. Lo que hay que preguntarle a la clienta

Estas bloquean decisiones técnicas, no son de diseño. La lista completa está en el spec
§11; estas son las que bloquean el trabajo inmediato:

1. **Fotografía de producto** — es lo que más bloquea hoy. ¿Hay imágenes limpias de los
   proveedores, o hay que hacer la sesión?
2. **Catálogo completo** — cuántos productos y variantes al lanzar. Decide si hace falta
   importación masiva en v1.
3. **Porcentaje de no-entrega en contra entrega** — decide la política de reservas del
   Bloque C. Ella sabe el número.
4. **Pasarela** — ¿ya se habló con PayU? La categoría se declara honestamente en el
   onboarding; esto es lo más riesgoso del proyecto y es calendario, no código.
5. **Envío** — tarifa plana, por ciudad o gratis desde un monto. El handoff muestra
   `$12.000` fijo en el resumen del checkout, que es un supuesto de diseño, no un dato.
6. **Empaque discreto, en concreto** — qué remitente aparece en la guía. Es una promesa que
   el sitio hace por escrito, así que tiene que ser cierta.
