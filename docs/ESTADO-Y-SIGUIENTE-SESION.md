# Estado del proyecto y siguiente sesión

Documento vivo. Se actualiza al final de cada sesión de trabajo: qué quedó hecho, qué
quedó abierto y qué sigue. Si vas a retomar el proyecto, **lee esto primero y después
`CLAUDE.md`**.

**Última actualización:** 5 de agosto de 2026 — sesión "Bloque C": el checkout
escribe `Order` de verdad — snapshots, reserva atómica de stock, número
`SECRETO-`, idempotencia, expiración de reservas — y hay un e2e de Playwright
que compra de punta a punta. También: ADR 002 (Wompi primero, PayU respaldo).

---

## 1. Dónde estamos

| Fase                        | Estado                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Diseño**              | **Implementada.** Age gate, Home, Catálogo, Producto y Checkout (3 pasos) según el handoff SECRETO. Falta la aprobación de la clienta                                                                 |
| **1 — Catálogo**            | **En curso.** Esquema, migración, seed **y pipeline de importación desde los dos proveedores** listos (`docs/IMPORT-PROVEEDORES.md`). Falta el CRUD del panel admin y la curaduría real de la clienta |
| **2 — Carrito y checkout**  | **Implementada (Bloque C).** El checkout escribe `Order` + `OrderItem` con snapshots, reserva stock atómicamente y libera reservas vencidas. Falta el arranque de pago real (Bloque F)                 |
| **3 — Pagos**               | No empezada. Existen el puerto `PaymentProvider` y `MockProvider`; los adaptadores esperan cuenta de comercio                                                                                         |
| **4 — Admin y lanzamiento** | **Bloque D completo.** El panel autentica con better-auth, gestiona pedidos con transiciones que escriben al libro, y ya tiene CRUD de productos con el sistema de opciones y ajuste de stock en dos toques |

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

**Objetivo: Bloque C — que el paso 3 del checkout escriba pedidos de verdad.**
Antes, la pasarela: ADR 002 (`docs/decisions/002-pasarela-wompi-vs-payu.md`)
compara PayU y Wompi con números y voltea la prioridad del ADR 001: **Wompi
primero, PayU respaldo documentado**. El precio de tarjeta empata (las curvas se
cruzan en $100.000, en mitad del rango de la tienda); lo que pesa es Nequi/PSE
(más baratos y más discretos), la liquidación D+1 y el costo de integración.
PayU conserva la carta clave: publica "Sex shop y artículos eróticos" como
*Restringido* (permitido con autorización) en Colombia. Las páginas legales
subieron a bloqueantes de onboarding.

Lo construido (detalle por pieza en el Bloque C de §4):

- `schemas.ts` — la bolsa es entrada no confiable; Zod normaliza celular,
  documento y correo, y exige el correo solo para pago en línea.
- Migraciones `order_idempotency_key` y `guest_address` — generadas con
  `prisma migrate diff` contra una Postgres descartable (documentado:
  `SHADOW_DATABASE_URL` en `.env.example`). **Pendientes de `migrate deploy`
  contra Neon.**
- `stock.ts` — reserva/liberación/venta con `UPDATE` crudo condicional; el
  libro de inventario quedó partido por razón (física ↔ reserva) y
  `parity.test.ts` concilia ambos saldos.
- `actions.ts` — `createOrder` con snapshots, dirección de invitado,
  idempotencia, conflictos por línea y barrido oportunista de reservas
  vencidas. `expiry.ts` + `/api/cron/release-reservations` (respaldo diario).
- `CheckoutFlow` — paso 2 con los campos de facturación colombiana
  (documento, departamento), correo opcional-salvo-online; paso 3 llama la
  acción, muestra conflictos con resolución de un gesto y el número
  `SECRETO-` al confirmar. La bolsa se vacía solo cuando el servidor confirma.
- E2E Playwright que compra de punta a punta, verificado contra una Postgres
  local: el pedido `SECRETO-7J5VZ6` quedó en la base con su reserva y su
  movimiento — no es un mock. Ojo: el e2e compra un producto demo, así que la
  base local diverge de los fixtures después de correrlo; `npx prisma db seed`
  (con `SEED_ALLOW_ORDER_WIPE=1`, porque ahora hay pedidos) la restaura.

Verificado: `tsc`, lint, **79 pruebas** con base (serializadas: paridad afirma
sobre el catálogo entero) y 58 + 21 saltadas sin base, build en ambos modos, y
el e2e en Chromium real. Los archivos de prueba con base corren en serie
(`vitest.config.ts`); sin base, en paralelo como siempre.

---

### Sesión anterior — 31 de julio de 2026 — Pulido del storefront

**Objetivo: pulir el storefront ahora que hay fotografía real.** Al ver el
catálogo importado en producción aparecieron cuatro fallos visuales; todos
tenían causa raíz identificable.

**Las fotos ahora llenan la tarjeta.** No era CSS: la URL guardada trae la
transformación `c_pad` (4:5 con franjas arena), así que una foto de proveedor
sobre blanco flotaba como rectángulo dentro del marco. Las tarjetas hacen
cirugía de URL en render (`src/lib/cloudinary-url.ts`: `c_pad…` → `c_fill,
ar_4:5,g_auto`) en la frontera del DTO — las URLs guardadas no se tocan (la
idempotencia del import se apoya en ellas) y la galería del PDP conserva a
propósito la pieza completa con su campo arena. El modal de la home también
dejó de mostrar siempre el placeholder.

**Tarjetas de altura uniforme.** La tarjeta llena su celda (`h-full` flex),
el nombre reserva exactamente dos líneas (`line-clamp-2` + `min-h` en em) y la
fila de precio queda clavada al borde inferior. El PLP ganó el paso `md:` que
faltaba (3 columnas en tablet; el sidebar solo existe en `lg`).

**Iconos, según la guía y con dos desviaciones registradas.** La guía permite
Lucide outline stroke 1.5 "donde se necesiten (bolsa, búsqueda, flechas)":
`ShoppingBag` en "Bolsa", `ChevronLeft/Right` en la galería, `Mail` decorativo
en la asesoría (sin mailto — **no existe correo comercial todavía**; cuando lo
haya, agregarlo a `src/lib/contact.ts` y al footer es una línea). Desviaciones:
(1) lucide 1.x no trae glifos de marca y la guía veta los rellenos → Instagram/
WhatsApp usan stand-ins semánticos (`Camera`/`MessageCircle`) siempre junto a
su texto; (2) en el footer vino los iconos heredan marfil como el texto (la
regla cuerpo/vino asume superficie clara). Convención definida: `size-4`
inline, `size-5` en controles de ≥44px. El pill de WhatsApp sigue sin icono
(solo su `→`, como manda el handoff).

**La galería del PDP tiene señales.** Antes era un scroll-snap con la barra
oculta: en desktop nada indicaba que había más fotos. Ahora: 0 fotos →
placeholder servidor; 1 foto → sin JS de cliente; 2+ → reel con flechas
(deshabilitadas en los extremos) y puntos-botón bajo la imagen, swipe intacto.

**El héroe vende: escaparate con crossfade.** Layout, copy, gradiente y CTAs
aprobados quedaron verbatim; el marco 4:5 de la derecha (que en móvil ni
existía) ahora rota una foto real por familia — lencería, cosmética,
juguetería — con crossfade solo de opacidad (650ms cada 5s), pausa en hover y
foco, puntos para control directo, un solo link al producto visible
("productos a un tap", la intención del spec), y visible en móvil. Sin fotos
(fixtures / DB-less) vuelve el placeholder aprobado exacto. Entrada única
escalonada del texto (opacity + 8px, 300ms, stagger 60ms).

**Enmienda de movimiento — pendiente del visto bueno de la clienta.** El
handoff solo sanciona hovers de 150–200ms y calla sobre entradas y carruseles.
El crossfade (650ms) y la entrada (300ms) son una extensión deliberada y
acotada, declarada en `globals.css` (`--motion-crossfade`, `--motion-entrance`,
bloque comentado "MOTION AMENDMENT") — ease-out, solo opacity/transform, sin
bounces. El bloque global de `prefers-reduced-motion` ahora también anula
`animation-delay` (el fill `both` + stagger dejaba contenido invisible para
esos usuarios) y el intervalo del escaparate ni arranca bajo reduced motion.

Verificado: `tsc`, lint, 46 pruebas + 6 de paridad saltadas sin base (las 8
nuevas de `cloudinary-url` y `heroSlides` incluidas), build con y sin
`DATABASE_URL`, y revisión en navegador contra la local (1280/768/375,
reduced motion, DB-less). Deuda nueva anotada en §5.

---

### Sesión anterior — 29 de julio de 2026 — Importación de proveedores

**Objetivo: construir el catálogo real importando desde los dos proveedores de
la clienta.** Ella no tiene catálogo propio — todo sale de
distrisexcolombia.com (WooCommerce, mayorista, ~900 productos) y climax.com.co
(Shopify, competidor minorista, ~376). Los proveedores ya habían autorizado
usar sus fotos y datos. Runbook completo: `docs/IMPORT-PROVEEDORES.md`.

**El pipeline es curaduría antes que volcado.** `scripts/import/` con cinco
comandos: `import:check` (preflight de Cloudinary con subida real),
`import:distrisex` / `import:climax` (bajan TODO a staging git-ignored, con
rate limit de 700 ms, User-Agent identificable y robots.txt verificado — ambas
APIs son públicas y permitidas), `import:revision` (página HTML local con los
1.275 productos, fotos, filtros y export de la selección) e `import:promote`
(solo lo aprobado en `scripts/import/seleccion.json` — commiteado — pasa al
catálogo).

**La normalización cae limpia en el modelo polimórfico.** Woo regala la
distinción opción-vs-spec (`attributes[].has_variations`); el registro INVIMA
llega como spec. Shopify trae opciones/variantes con precio y SKU reales; las
fotos que Shopify ata a un color quedan con `ProductMedia.optionValueId`. Todo
producto termina con ≥1 variante por construcción. El listado de Woo no trae
precio por variación: si `price_range` existe, el promote pide cada variación
individual — solo de lo aprobado, así son un puñado de peticiones (verificado:
Leda Lerot SM $110.000 / ML $82.000 con SKUs reales del proveedor).

**El precio del proveedor es referencia, nunca precio de venta.** Climax es
competidor minorista y DistriSex publica mayorista (a veces con "Precio
sugerido" escondido en el HTML — se conserva como pista). El precio de venta
sale de `seleccion.json`: override por producto o margen por proveedor
(defaults de trabajo: DistriSex +50 %, Climax +0 %), redondeado hacia arriba.
**El margen real por categoría sigue siendo decisión pendiente de la clienta.**

**Cloudinary quedó activo y con las fotos fluyendo.** Preflight verificado
contra la cuenta real (`cs2uzjap`), 57 imágenes de proveedor re-hospedadas
(nunca hotlink, nunca al repo), `public_id` determinista por hash del origen y
URL de entrega con la transformación de la guía de marca
(`c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto` — 4:5 sobre arena). El Bloque E ya
no necesita preprocesamiento manual para fotos de proveedor.
`CLOUDINARY_URL` documentada en `.env.example` en el mismo commit que empezó a
leerla.

**Idempotencia por `Product.supplierRef`** (namespaced `distrisex:<id>` /
`climax:<handle>`): re-correr actualiza y jamás duplica — variantes por
`optionKey`, media por URL determinista, slug estable, y el stock **nunca** se
toca en updates. El stock inicial entra por `InventoryMovement` en la misma
transacción (regla 3). Verificado en corrida doble: `14 created → 14 updated,
0 duplicados, 0 re-subidas`, y el libro de inventario concilia en las 42
variantes de la base local.

**Guardarraíl de base de datos:** el promote corre contra la local de Docker;
si la URL apunta a `neon.tech` sin `--neon` explícito, se niega (probado). A
Neon solo cuando la clienta apruebe el staging. `SEED_ALLOW_ORDER_WIPE` quedó
intacto.

**Las tarjetas del catálogo ahora muestran fotografía real.** La galería del
PDP ya sabía renderizar `ProductMedia`; la tarjeta tenía el placeholder
cableado en duro y `ProductCardDTO` ni siquiera exponía imagen. Se agregó
`image` al DTO (primer media; un video cae a su `posterUrl`) y el `<img>` 4:5
en `ProductCard` — placeholder solo cuando no hay foto, que sigue siendo el
caso de los 6 productos demo. Verificado contra la local: 20 tarjetas, 14 con
foto de Cloudinary, 6 con placeholder; paridad intacta (fixtures sin media ↔
demo sin media).

**Selección de demostración:** 14 productos reales en `seleccion.json` que
ejercitan todos los caminos (Talla Woo con precio por variación, opciones
Shopify, color con foto por variante, sin opciones, las 3 categorías, override
de precio, tope de 8 imágenes). Es de demostración: la curaduría real la hace
la clienta sobre `revision.html`.

Verificado: `npx tsc --noEmit`, `npm run lint`, `npm run build` y las 44
pruebas en verde (paridad contra Neon incluida — el demo de Neon quedó
intacto). Nota operativa: una local con importados diverge de los fixtures a
propósito; `npx prisma db seed` la devuelve al estado demo.

---

### Sesión anterior — 28 y 29 de julio de 2026 — Infraestructura en la nube

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

### Bloque C — Órdenes reales en el checkout ✅ hecho (agosto 2026)

El paso 3 escribe de verdad. Lo construido, y las decisiones que lo acompañan:

- **La bolsa es entrada no confiable.** `createOrder` acepta solo
  `{ variantId, qty, expectedPriceCents }`; el precio se relee de la base al crear.
  `expectedPriceCents` es lo que el cliente VIO — nunca lo que paga — y sirve para
  devolver conflictos por línea (`PRICE_CHANGED`, `OUT_OF_STOCK`, `INACTIVE`) que la
  UI resuelve con un gesto (aceptar precio nuevo / quitar de la bolsa).
- **Snapshots** en `OrderItem` (nombre, marca, SKU, etiqueta de opciones, precio,
  imagen) y **dirección de invitado**: `Address.customerId` pasó a nullable
  (migración `guest_address`) — un pedido guest no crea `Customer`.
- **Reserva atómica.** El guard del spec §6.4 no compilaba (Prisma no expresa
  columna contra columna+parámetro): es un `UPDATE` crudo condicional en
  `stock.ts`, probado con 8 transacciones concurrentes peleando la última unidad.
  El libro quedó partido por razón: movimientos físicos concilian `stockOnHand`;
  `RESERVATION`/`RESERVATION_RELEASE` concilian `stockReserved`; una venta pagada
  escribe dos filas. `parity.test.ts` exige ambas conciliaciones.
- **Idempotencia:** `Order.idempotencyKey` único (migración `order_idempotency_key`),
  un UUID por intento de checkout — doble tap o request reintentado devuelve el
  mismo pedido.
- **`orderNumber`** `SECRETO-` + 6 símbolos sin ambiguos (nanoid), reintento ante
  colisión.
- **Expiración de reservas:** 72 h (contra entrega y online mientras el proveedor
  es mock — Bloque F la baja a 30 min online cuando exista redirect real).
  Barrido en `expiry.ts` con transición condicional `PENDING→CANCELLED`, corre
  oportunista al inicio de `createOrder` y como respaldo en
  `/api/cron/release-reservations` (`CRON_SECRET`; `vercel.json` lo agenda diario —
  tier Hobby — y el barrido oportunista cubre el resto).
- **E2E real:** `playwright.config.ts` + `e2e/checkout.spec.ts` compran de punta a
  punta (age gate → PDP → bolsa → 3 pasos → `SECRETO-…` visible y bolsa en 0).
  Salda la deuda "Playwright sin pruebas".
- **Pendiente del bloque:** confirmar 72 h con el porcentaje real de no-entrega de
  la clienta (§6), y el correo de confirmación (Resend, Fase 2).

### Bloque D — Panel admin ✅ completo

**Hecho (2026-08-06).** Autenticación con `better-auth` y la mitad de pedidos:

- Sesión por correo y contraseña sobre `User` / `Session` / `Account` / `Verification`
  (migración `admin_auth`). **El registro está deshabilitado a propósito**: better-auth
  monta un endpoint de alta por defecto y, en una tienda desplegada, eso deja que
  cualquiera se cree una cuenta al panel donde se ven nombres, teléfonos y cédulas. Las
  cuentas se crean con `ADMIN_PASSWORD='…' npm run admin:create -- --email …`.
- `/admin/pedidos` — lista con filtro por estado y contadores; `/admin/pedidos/[número]`
  — detalle con artículos (snapshots), datos de facturación colombianos y pago.
- Transiciones de estado como **máquina de estados pura** en
  `src/features/orders/transitions.ts`, con el efecto sobre el inventario declarado por
  transición (`release` / `commit` / `return` / `none`) en vez de deducido del par. Es la
  parte del panel que puede corromper el libro en silencio, así que vive en un módulo que
  un test puede leer entero — 12 pruebas fijan las invariantes (solo se envía desde
  `PROCESSING`, cancelar siempre libera, reembolsar siempre devuelve).
- La acción hace **compare-and-set** sobre el estado que vio el panel: el barrido de
  reservas vencidas cancela pedidos por su cuenta, así que un "cancelar" desde una pestaña
  vieja podía llegar cuando el pedido ya no estaba en `PENDING` y liberar stock dos veces.
- `e2e/admin-orders.spec.ts` — el gate rechaza sin sesión, y una asesora entra, ve el
  pedido recién comprado y lo lleva hasta entregado.

**Y la segunda mitad (misma fecha).** `/admin/productos`:

- Lista con estado, stock disponible agregado y alerta de poco stock; crear y editar
  producto (marca, categoría, referencia, estado con `publishedAt` en la primera
  activación — el slug nunca cambia: es la URL ya compartida por WhatsApp).
- **Opciones y valores solo crecen** desde el panel; quitar uno dejaría huérfanas
  variantes con historial en el libro. La jugada reversible es desactivar la variante.
- **Generar combinaciones**: producto cartesiano de los valores, saltando los
  `optionKey` que ya existen — generación aditiva, nunca reconstrucción. SKU propuesto
  `REF-VALOR-VALOR` (editable), precio de entrada para las nuevas.
- **Ajuste de stock en dos toques** (`src/features/products/stock-adjust.ts`): − / + y
  Aplicar, con el motivo siguiendo el signo (entra → `PURCHASE`, sale → `MANUAL_ADJUST`
  o `DAMAGE`). Mismo patrón que el checkout: un UPDATE condicional que **no deja caer
  `stockOnHand` por debajo de `stockReserved`** — esas unidades son de pedidos abiertos —
  y la fila del libro en la misma transacción. Probado con 8 ajustes concurrentes
  peleando 3 unidades: ganan exactamente 3 y el libro reconcilia.
- El stock inicial de un producto nuevo es 0 a propósito: las unidades entran por el
  ajuste, que es lo que escribe de dónde salieron.
- `e2e/admin-products.spec.ts`: crear → opciones → generar → recibir 5 unidades →
  publicar → verlo en la tienda.

**Fuera de alcance, deliberadamente:** medios del producto (el pipeline de Cloudinary es
el dueño de la fotografía, Bloque E/H) y borrado de variantes u opciones (romperían el
libro y el historial de pedidos — se desactiva, no se borra).

**Antes de desplegar el panel:** cargar `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` en
Vercel — sin ellas `/admin` no autentica, y `BETTER_AUTH_URL` tiene que coincidir con el
origen real o la cookie de sesión se emite para otro host.

### Bloque E — Fotografía y Cloudinary 🔄 desbloqueado a medias

Cloudinary está **activo y cableado**: el pipeline de importación re-hospeda
las fotos de proveedor con la transformación de la guía de marca (4:5 sobre
arena) y la tienda las muestra en tarjeta y galería. Lo que sigue siendo de la
clienta: fotografía **propia** (sesión sobre arena `#F1E7D8`, luz cálida) para
lencería sin foto usable y para el video, que el modelo ya soporta con
`posterUrl`. Los 6 productos demo siguen en placeholder a propósito.

### Bloque H — Importación de proveedores ✅ pipeline listo

`scripts/import/` + `docs/IMPORT-PROVEEDORES.md`. Staging completo de los dos
proveedores (1.275 productos), curaduría visual (`import:revision`), promote
idempotente con guardarraíl anti-Neon. Abierto: la **curaduría real** de la
clienta (hoy hay 14 productos de demostración en `seleccion.json`) y el
**margen por categoría**. Cuando ella apruebe: `npm run import:promote -- --neon`.

### Bloque F — Pagos 🔄 pasarela comparada, decisión propuesta

Depende de la aprobación de la cuenta de comercio, que es calendario, no código. El puerto
y el mock ya existen; el adaptador y el webhook con verificación de firma e idempotencia
entran cuando haya cuenta. Ver `docs/decisions/001-payment-provider.md` y, para la
comparación completa, **`docs/decisions/002-pasarela-wompi-vs-payu.md`**.

**Lo que cambió (agosto 2026):** se compararon PayU y Wompi en precio, liquidación,
mezcla de medios de pago y costo de integración. Resumen:

- **El precio de tarjeta es un empate.** Las dos curvas se cruzan en exactamente
  COP 100.000 — justo en medio del rango de esta tienda ($45.000–$120.000). A 100
  pedidos de $80.000 al mes, elegir una u otra vale ~COP 7.000 mensuales.
- **Lo que sí vale plata es la mezcla de medios.** Nequi (1,79 %) y PSE son más
  baratos y más discretos que la tarjeta; una mezcla realista sale ~18 % más barata
  que todo-tarjeta. Nequi solo existe del lado de Wompi.
- **Wompi gana liquidación** (día hábil siguiente, sin costo de retiro) contra PayU
  (3 días hábiles, 3 retiros gratis al mes y luego $6.500 + IVA), y gana costo de
  integración (API REST moderna, firma SHA-256, webhook HMAC que calza tal cual con
  el puerto que ya existe).
- **PayU gana la única carta que importaba de verdad:** publica una tabla por rubro
  donde **"Sex shop y artículos eróticos" figura como *Restringido* en Colombia** —
  o sea, permitido con autorización expresa. Wompi no publica nada equivalente; su
  reglamento habla en genérico y la contraparte es Bancolombia.
- **Propuesta:** abrir las dos conversaciones la misma semana declarando la
  categoría por escrito, con **Wompi primero y PayU como respaldo documentado**, y
  escribir el adaptador de Wompi contra el sandbox antes de que haya cuenta, para
  sacar la pasarela de la ruta crítica.

**Bloqueantes de onboarding que no son código** (detalle en el ADR 002): RUT, cédula,
comprobante de domicilio, extractos; cuenta Bancolombia o Nequi a nombre de quien
registra —si es persona natural, con más de 30 días y **el primer desembolso llega a
los 30 días de la primera venta**—; y las **páginas legales publicadas y accesibles**.

### Bloque G — Arquitectura en la nube 🔄 en curso

El objetivo es que nada dependa de que una máquina en particular esté prendida.
Dónde estamos:

| Pieza                | Estado                                                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de datos        | ✅ **Neon**, gestionada, verificada de punta a punta                                                                                                            |
| Repositorio          | ✅ GitHub                                                                                                                                                       |
| Hosting              | ✅ **Vercel** — `secretxoxo-shop`, importado desde el repo, con variables cargadas y leyendo de Neon                                                            |
| CI                   | ✅ `.github/workflows/ci.yml` — lint, migraciones, seed, suite completa y build contra un Postgres real en cada push y PR a `main`                              |
| Imágenes             | ✅ **Cloudinary** (`cs2uzjap`) — activo, verificado con subidas reales; el pipeline de importación re-hospeda fotos de proveedor con la transformación de marca |
| Correo transaccional | ⬜ Resend, en `.env.example` y sin cablear. Fase 2                                                                                                              |
| Autenticación admin  | ✅ **better-auth** — sesión por correo y contraseña, registro deshabilitado, cuentas por `npm run admin:create`. Falta `BETTER_AUTH_SECRET` y `BETTER_AUTH_URL` en Vercel                       |

**Producción:** https://secretxoxo-shop.vercel.app — cada push a `main` despliega
solo y cada PR recibe su URL de preview. Comprobado que lee de Neon contando
lecturas sobre `Product` del lado de la base, no confiando en que responda 200:
las dos fuentes sirven contenido idéntico por diseño y el HTML no las distingue.
Detalle en `docs/NEON-CLOUD.md` §5.

Lo único que queda deliberadamente local es el Postgres de Docker, y solo porque
`prisma migrate dev` necesita una base descartable para generar migraciones.

---

## 5. Deuda abierta

| Deuda                                        | Nota                                                                                                                                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sslmode=require` sin decidir                | El driver `pg` avisa que hoy `require` se comporta como `verify-full`, y que en `pg` v9 pasará a la semántica de libpq, más débil. Dejarlo explícito en `?sslmode=verify-full` es un no-op hoy y evita una degradación silenciosa mañana  |
| ~~Playwright instalado sin pruebas~~ ✅       | Saldada en Bloque C: `e2e/checkout.spec.ts` compra de punta a punta. Corre local (`npx playwright test` con `DATABASE_URL`); falta decidir si entra al CI                                                                                 |
| ~~El checkout no persiste~~ ✅                | Saldada: Bloque C. El paso 3 escribe `Order` + reserva. Las migraciones de Bloque C **ya están aplicadas en Neon** (`migrate deploy`, 2026-08-06), así que la preview de Vercel acepta pedidos de invitado                                  |
| Cron del sweeper en tier Hobby               | `vercel.json` agenda el barrido de reservas vencidas una vez al día (límite Hobby). `createOrder` barre oportunistamente al arrancar, así que el hueco real es una tienda sin ventas por horas. En Pro: subir a `*/10`. Falta `CRON_SECRET` en Vercel |
| Correo de confirmación de pedido             | El pedido se confirma en pantalla y por WhatsApp; no hay email transaccional todavía (Resend, Fase 2). Cuando exista: remitente y asunto neutros, sin nombres de producto (regla 2)                                                        |
| Admin a medias                               | Pedidos listos (lista, detalle, transiciones de estado con efecto en el libro). Falta el CRUD de productos con el sistema de opciones y el ajuste de stock en dos toques — ver Bloque D                                                    |
| Pago en línea sin registrar en el pedido     | `createOrder` solo escribe una fila `Payment` para contra entrega, que es el único método conocido en el checkout. Con `ONLINE` la pasarela elige el riel y su webhook escribe la fila (Bloque F); hasta entonces el panel muestra "la pasarela todavía no registra un intento" |
| Fotos propias pendientes                     | Los importados ya muestran la foto del proveedor vía Cloudinary; el demo sigue en placeholder. La sesión propia (arena, luz cálida) queda para lo que no tenga foto usable — ver Bloque E                                                 |
| Descripciones sin pasada editorial           | El promote guarda la descripción del proveedor limpiada de HTML. El tono clínico SECRETO (material, medidas, cuidado) es una pasada editorial por producto que nadie ha hecho                                                             |
| Curaduría y margen: decisión de negocio      | `seleccion.json` trae 14 productos de demostración y márgenes de trabajo (+50 % DistriSex, +0 % Climax). La clienta decide el subconjunto real (con `revision.html`) y el margen por categoría — ver §6                                   |
| Enmienda de movimiento sin aprobar           | El escaparate del héroe y la entrada escalonada extienden el spec de movimiento del handoff (que solo define hovers de 150–200 ms). Valores en `globals.css` como `--motion-*`; se aprueban con la Fase 0 o se apagan quitando dos clases |
| **Páginas legales inexistentes** ⚠️           | Subió de prioridad: no es deuda cosmética, es **bloqueante del onboarding de la pasarela** — el análisis de riesgo revisa la tienda en vivo. Faltan tratamiento de datos (Ley 1581/2012), términos y condiciones, envíos y devoluciones (ojo: el retracto de 5 días del Estatuto del Consumidor generalmente **excluye** productos de higiene personal e íntimos — decirlo con precisión). "Envíos y garantía" y "Privacidad" siguen en `href="#"`. Ver ADR 002 |
| `mediaForSelection` sin cablear              | Fotos por color elegido: implementado y testeado, pero conectar la galería al picker exige reestructurar el PDP en isla cliente (hoy `Gallery` y `PurchasePanel` son hermanos server). Evaluado y diferido                                |
| Correo comercial inexistente                 | No hay dirección de email del negocio en ningún punto de contacto; el icono Mail de la asesoría es decorativo. Cuando exista: `src/lib/contact.ts` + footer                                                                               |
| `package.json` sigue llamándose `xoxo-store` | Cosmético, sin urgencia. El repo también. Solo importa lo que ve el cliente                                                                                                                                                               |
| Lighthouse sin medir                         | El criterio de éxito del spec (≥ 90 móvil) no se ha verificado; medirlo con imágenes reales, no con placeholders                                                                                                                          |
| Descriptor de pago sin acordar               | `SECRETO BTQ` es la propuesta del handoff; hay que confirmarla con la pasarela en el onboarding                                                                                                                                           |

---

## 6. Lo que hay que preguntarle a la clienta

Estas bloquean decisiones técnicas, no son de diseño. La lista completa está en el spec
§11; estas son las que bloquean el trabajo inmediato:

1. **Curaduría del catálogo** — sentarse con `data/import/revision.html`
   (generarla con `npm run import:revision`) y marcar qué vende de los 1.275
   productos de los proveedores. El permiso de los proveedores ya está resuelto;
   las fotos ya fluyen solas.
2. **Margen por categoría** — los defaults (+50 % DistriSex, +0 % Climax) son
   de trabajo. Con su número real, `pricing.marginPct` en
   `scripts/import/seleccion.json` y listo.
3. **Porcentaje de no-entrega en contra entrega** — decide la política de reservas del
   Bloque C. Ella sabe el número.
4. **Pasarela** — la comparación ya está hecha (`docs/decisions/002-pasarela-wompi-vs-payu.md`):
   la propuesta es **Wompi primero, PayU de respaldo**, abriendo las dos conversaciones la
   misma semana y declarando la categoría por escrito. Lo que hace falta de su lado:
   (a) ¿la tienda se registra como persona natural o jurídica? —si es natural, el primer
   desembolso de Wompi llega a los 30 días de la primera venta—; (b) ¿tiene cuenta
   Bancolombia o Nequi a su nombre, con más de 30 días?; (c) RUT, cédula, comprobante de
   domicilio y extractos de los últimos 3 meses. Esto es lo más riesgoso del proyecto y es
   calendario, no código.
5. **Envío** — tarifa plana, por ciudad o gratis desde un monto. El handoff muestra
   `$12.000` fijo en el resumen del checkout, que es un supuesto de diseño, no un dato.
6. **Empaque discreto, en concreto** — qué remitente aparece en la guía. Es una promesa que
   el sitio hace por escrito, así que tiene que ser cierta.
