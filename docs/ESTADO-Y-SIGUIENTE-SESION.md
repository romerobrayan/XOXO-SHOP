# Estado del proyecto y siguiente sesión

Documento vivo. Se actualiza al final de cada sesión de trabajo: qué quedó hecho, qué
quedó abierto y qué sigue. Si vas a retomar el proyecto, **lee esto primero y después
`CLAUDE.md`**.

**Última actualización:** 13 de agosto de 2026 — sesión "Bloque I: la clienta
cura desde el panel". La curaduría completa del catálogo ya no depende de esta
máquina: fotos de producto que se suben desde el celular o el computador a
Cloudinary (sin EXIF/GPS en lo que sirve la tienda), el staging de los 1.275
productos de proveedor viviendo en Postgres y navegable en
`/admin/proveedores` con **Publicar** corriendo el mismo promote del CLI,
archivar/restaurar de un toque con borrado real solo para productos sin
historia, y `/admin` convertido en dashboard de ventas leído directo de la
base. `CLOUDINARY_URL` ya quedó cargada en Vercel (Production y Preview).
Pendiente operativo al desplegar: `migrate deploy` + `import:stage -- --neon`
contra Neon (ver §3).

Antes — mismo día, sesión "Bloque F: pago en línea": el pago online funciona
de punta a punta contra el **sandbox real de Wompi**; el webhook idempotente
marca pagado vía la máquina de estados y la firma de integridad quedó
confirmada con transacciones reales. Falta un paso que no es código: la
**URL de eventos en el panel de Wompi** (ver Bloque F).

---

## 1. Dónde estamos

| Fase                        | Estado                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Diseño**              | **Implementada.** Age gate, Home, Catálogo, Producto y Checkout (3 pasos) según el handoff SECRETO. Falta la aprobación de la clienta                                                                 |
| **1 — Catálogo**            | **Herramienta completa (Bloque I).** Esquema, seed, pipeline de importación, CRUD del panel, **fotos desde el panel y curador de proveedores en `/admin/proveedores`**. Lo que falta es que la clienta ejecute su curaduría — ya puede, desde el celular |
| **2 — Carrito y checkout**  | **Implementada (Bloque C).** El checkout escribe `Order` + `OrderItem` con snapshots, reserva stock atómicamente y libera reservas vencidas. Falta el arranque de pago real (Bloque F)                 |
| **3 — Pagos**               | **Implementada contra el sandbox (Bloque F).** Arranque + webhook idempotente + página de retorno, verificados con transacciones reales de prueba. Production sigue en `mock` hasta la aprobación del comercio; falta la URL de eventos en el panel |
| **4 — Admin y lanzamiento** | **Bloques D e I hechos.** Autenticación better-auth, pedidos con máquina de estados, CRUD de productos con opciones y stock en dos toques, **fotos a Cloudinary desde el panel, curador de proveedores, archivar/restaurar con borrado guardado y dashboard de ventas en `/admin`**. Bloque I espera deploy (migración + staging en Neon + `CLOUDINARY_URL` en Vercel) |

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

Para entrar al panel en local sin ceremonia: `npm run admin:dev` crea (o
restablece) la cuenta **admin@secreto.local / Admin123** — solo desarrollo; el
script se niega contra Neon, en Vercel y con `NODE_ENV=production`, con el
mismo gesto que el guardarraíl del promote. Las cuentas reales siguen saliendo
de `admin:create`, que exige 12 caracteres.

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

**Objetivo: Bloque I — que la CLIENTA haga la curación completa del catálogo
desde el panel, desde el celular o el computador por igual.** Hasta hoy, la
curaduría solo corría en esta máquina (`revision.html` local) y las fotos solo
entraban por el pipeline. Ahora todo pasa por `/admin`:

- **Fotos de producto desde el panel.** `/admin/productos/[id]` ganó la
  tarjeta "Fotos": subir (en el celular abre cámara o galería — el input es
  `accept="image/*"`; en desktop, archivos), reordenar con flechas y quitar
  con confirmación de dos toques. La subida viaja por Server Action
  (FormData validada con Zod: solo imágenes, 10 MB máximo,
  `bodySizeLimit` 15 MB) y aterriza en Cloudinary **server-side** con
  `public_id` determinista por contenido
  (`secreto/productos/panel/<sha1(bytes)>`): la misma foto elegida dos veces
  mapea al mismo asset, jamás duplica. La entrega guarda la transformación de
  marca (4:5 sobre arena), y **las derivadas no exponen EXIF/GPS**:
  `media.cloudinary.test.ts` sube contra la cuenta real un JPEG con bloque
  GPS y verifica que el marker no llega a lo que la tienda sirve. Quitar una
  foto borra la fila, resecuencia y destruye el asset **solo** si es del
  namespace del panel y ninguna otra fila lo referencia — los assets de
  proveedor nunca se tocan (el re-promote depende de ellos). La primera foto
  es la portada y así lo dice la UI.
- **El SDK de Cloudinary tiene una sola puerta.** `src/lib/cloudinary.ts` —
  movido desde `scripts/import/lib/` — es el único módulo que lo importa;
  pipeline y panel comparten convenciones de `public_id`, transformación y
  subida (`overwrite: false`). `cloudinary` pasó a `dependencies`: ahora es
  runtime del panel, no solo tooling.
- **El staging de proveedores vive en Postgres.** Decisión tomada y
  documentada (`docs/IMPORT-PROVEEDORES.md`): la tabla
  `SupplierStagingProduct` guarda los 1.275 productos normalizados (payload
  completo validado con Zod al leer, `searchText` normalizado para buscar,
  precio del proveedor como referencia, primera foto para la lista). La
  alimenta `npm run import:stage` desde los JSON del fetch — idempotente por
  `supplierRef`, **jamás toca el estado de curaduría en re-corridas**, con el
  mismo guardarraíl anti-Neon del promote (`--neon` explícito para la base
  del despliegue). Cargada y verificada en la local con corrida doble
  (1.275 → 1 created/1.274 updated, 0 duplicados). De paso el staging destapó
  un caso real: variaciones Woo con atributo "any" (null) — el esquema las
  tolera, descarta el valor nulo, y el promote bota la variación incompleta
  con aviso en vez de reventar.
- **`/admin/proveedores`: el curador.** Lista con búsqueda (sin acentos),
  filtros por proveedor/categoría/estado (Pendientes/Publicados/Todos, con
  contadores), foto del proveedor (hotlink **solo** en esta pantalla interna
  — la tienda jamás), paginación de a 24. El detalle muestra fotos, ficha
  técnica, variantes con su precio de referencia, el "Precio sugerido" del
  mayorista cuando existe, y el formulario de publicación: categoría
  (sugerida por defecto), marca (detectada por defecto), **margen % con
  vista previa "queda desde…" que respeta las diferencias por variante, o
  precio manual** — el precio del proveedor nunca es el precio de venta — y
  stock inicial que entra por el libro. **Publicar** corre
  `src/features/import/promote-core.ts`: la MISMA normalización del promote,
  movida de `scripts/import/` a `src/` — el CLI quedó como wrapper delgado
  sobre el mismo núcleo, cero duplicación. Idempotencia intacta por
  `supplierRef`: re-publicar refresca nombre/descripción/specs/fotos y **no
  toca ni el precio que la clienta ajustó ni su stock** (probado contra
  Postgres en `promote-core.test.ts`). El guardarraíl "--neon solo con
  aprobación de la clienta" queda satisfecho por diseño: la que aprieta
  Publicar ES la clienta, con su sesión como firma.
- **Quitar = archivar.** Botones de un toque en la lista y en el detalle
  (`Archivar` / `Restaurar` — restaurar devuelve ACTIVE si alguna vez
  publicó, DRAFT si no). El storefront ya filtraba `ACTIVE` en lista,
  detalle y contadores de filtros, así que archivar desaparece el producto
  de la tienda al instante. **Borrado real solo sin historia**: la UI ofrece
  "Eliminar definitivamente" únicamente cuando el producto no tiene ni
  OrderItem ni InventoryMovement, y el guard se re-verifica **dentro de la
  transacción** (`lifecycle.test.ts` lo fija: movimiento → se niega; línea
  de pedido → se niega). Borrar también regresa a la cola la fila de staging
  que apuntaba al producto y limpia los assets del panel que quedaron sin
  referencias.
- **`/admin` es el dashboard.** Dejó de redirigir. **La definición de venta
  está escrita en la pantalla y en el código** (`SALE_DEFINITION`): un
  pedido pagado (en línea o transferencia; `paidAt`) o, en contra entrega,
  un pedido entregado — la máquina de estados confirma que contra entrega
  nunca pasa por PAID y cobra en la puerta. Cancelados y reembolsados no
  cuentan. Muestra: hoy / 7 / 30 días (ventas e ingresos), barras por día
  (14 días, con tabla `sr-only` para lectores), semanas (8) y meses (6) —
  todo `date_trunc` **en hora de Bogotá**, no UTC —, top 5 desde los
  snapshots de `OrderItem`, pedidos recientes con su estado y contadores de
  abiertos, y stock bajo (disponible = onHand − reservado ≤ umbral, solo
  variantes activas de productos activos). Cero Firebase, cero GA, cero
  trackers: la política publicada lo prohíbe y la analítica sale de la base
  (`metrics.test.ts` fija la definición con los cuatro casos). El login
  ahora aterriza en `/admin` y la pestaña "Inicio" existe en el nav.
- **Ambos dispositivos.** Todas las pantallas nuevas revisadas a 375px y
  desktop en navegador real: cero overflow horizontal, tarjetas en vez de
  tablas, botones de 36–44px, el nav del panel con scroll horizontal si no
  cabe. El patrón de referencia sigue siendo el ajuste de stock en dos
  toques.
- **Migración `bloque_i_staging_proveedores_y_media_unica`** — generada
  contra la local (con `migrate diff`, el flujo documentado) y aplicada:
  tabla de staging + `@@unique([productId, url])` en `ProductMedia` (la
  invariante que el import mantenía a mano, ahora la sostiene la base bajo
  concurrencia). **Pendiente de `migrate deploy` contra Neon al desplegar.**

**Verificación.** Suite completa de vitest contra la Postgres local de Docker
(las 142 previas más las nuevas de medios, promote-core, lifecycle y
dashboard — ninguna saltada), `tsc` y lint limpios, y los e2e con
`E2E_PORT=3100`: los 5 previos más (a) crear producto con foto desde el panel
→ verla en `/tienda` (subida REAL a Cloudinary), (b) archivar → desaparece de
la tienda y su URL deja de resolver, (c) sembrar un producto en staging →
curarlo con precio manual → verlo publicado en `/tienda` con ese precio.

**Para desplegar el Bloque I** (en orden, después del merge):

1. `npx prisma migrate deploy` contra Neon (aditiva: tabla de staging +
   unique de media).
2. ~~`CLOUDINARY_URL` en Vercel~~ ✅ **hecha en esta sesión** — Production y
   Preview, marcada sensible (verificada con `vercel env ls`). Sin ella el
   panel desplegado no podría subir fotos ni publicar del staging.
3. `npm run import:stage -- --neon` para que la clienta tenga los 1.275 en
   su curador.

---

### Sesión anterior — 13 de agosto de 2026 — Bloque F: pago en línea

**Objetivo: Bloque F — que "Transferencia o tarjeta" cobre de verdad.** Todo
lo que faltaba entre el adaptador puro de la sesión pasada y un pago que entra:
el arranque, el webhook y la verificación contra el sandbox con las llaves
`pub_test_` de la cuenta real de prueba.

- **El arranque del pago.** `createOrder` con `paymentMethod=ONLINE` construye
  el enlace firmado de Web Checkout, escribe la fila `Payment`
  (`PENDING`, `method` **null** — el riel lo elige el comprador dentro de Wompi
  y solo el evento lo sabe) y devuelve `checkoutUrl`; `CheckoutFlow` vacía la
  bolsa y redirige. La referencia es el número de pedido, así que un reintento
  con la misma `idempotencyKey` **re-deriva el mismo enlace byte a byte**
  (upsert por `providerReference`, cero filas duplicadas). El proveedor se
  construye antes de crear el pedido: un despliegue sin llaves falla antes de
  reservar stock, no después.
- **La reserva online con pasarela real dura 30 minutos** (la promesa que el
  Bloque C dejó anotada), y el enlace lleva `expiration-time` firmado con el
  **mismo instante**: pagar una reserva que el barrido ya liberó se vuelve
  imposible del lado de Wompi, no solo del nuestro. Con el mock no hay
  redirect real y la ventana sigue en 72 h (asesora por WhatsApp).
- **El webhook dejó de ser un TODO.** La ruta verifica la firma (adaptador) y
  delega en `applyPaymentEvent` (`src/features/orders/payment-events.ts`):
  con `APPROVED`, el pedido pasa `PENDING→PAID` **a través de la máquina de
  estados**, vía un ejecutor nuevo y compartido
  (`src/features/orders/apply-transition.ts`) que también usa el panel — CAS
  sobre el estado visto, timestamps y efecto de inventario en un solo lugar.
  **El webhook no llama `commitSale`, deliberadamente:** la máquina declara
  `PENDING→PAID` con efecto `none`, y `transitions.test.ts` fija la invariante
  *"consumes the reservation only when shipping"* — el stock se compromete
  **una sola vez**, en `PROCESSING→SHIPPED`, por el camino del panel ya
  probado. Un commit en el webhook rompería "Marcar enviado" (doble commit) y
  "Cancelar" (liberar sin reserva) para todo pedido pagado en línea.
- **Idempotencia sin tabla de dedupe: dos CAS.** `APPROVED` es terminal en
  `Payment` (toda escritura va guardada por `status != APPROVED`), y el flip
  del pedido es el mismo `updateMany` condicional del panel y el barrido.
  Eventos duplicados, concurrentes o fuera de orden actualizan cero filas y
  se van. El caso feo — plata que llega cuando el barrido ya canceló — se
  registra en el `Payment` (la plata se movió), **no toca stock** y deja log
  fuerte para conciliación humana.
- **Página de retorno `/checkout/gracias`** (el `redirect-url` del enlace):
  confirmando (se refresca sola mientras llega el evento), confirmado,
  rechazado —con "Reintentar el pago", que re-deriva el mismo enlace—,
  expirado, pago-tras-expirar y registrado (mock). Muestra número de pedido y
  total, nunca un dato personal: el número es la capacidad, como al citarlo
  por WhatsApp. Wompi documenta que el redirect no confirma nada; acá solo se
  lee lo que el webhook haya escrito.
- **Migración `payment_method_nullable`** (`method` de `Payment` admite null
  hasta que el evento diga el riel): generada contra la local, **aplicada en
  Neon** con `migrate deploy`. El panel muestra "En línea · riel por
  confirmar" mientras tanto, y el riel real (CARD/NEQUI/PSE…) lo escribe el
  evento.
- **142 pruebas, todas corriendo contra Postgres local** (las 26 que se
  saltaban sin base, incluidas). Nuevas: 8 de `payment-events` — 8 entregas
  concurrentes del mismo evento producen **un solo** `order_paid`; el flujo
  completo webhook→preparar→enviar descuenta stock **exactamente una vez** y
  el libro reconcilia; `DECLINED` tardío no regresa un pago aprobado; plata
  tras cancelación no toca el libro — 3 del arranque online en
  `actions.test.ts` (fila escrita, enlace idéntico en reintento, contra
  entrega intacta) y 2 del adaptador (firma con expiración contra digest de
  `sha256sum`, extracción del riel). e2e: 5/5, con el pago online llegando
  hasta el redirect con el enlace firmado completo.
- **Sandbox verificado con la cuenta real de prueba ("SECRETO BTQ" — ya
  existe, con el descriptor propuesto).** `checkout.wompi.co` devuelve 403 de
  CloudFront a los navegadores de esta máquina (WAF de Wompi; `curl` sí
  pasa), así que la verificación fue por la **API pública del sandbox — las
  mismas tres llamadas que el widget hace por dentro**, donde una firma
  equivocada muere con 422: transacción creada con la firma exacta del
  adaptador (con `expiration-time` incluido en la cadena), 4242 aprobó, 4111
  rechazó, y el reintento sobre la misma referencia aprobó. El webhook local
  procesó eventos construidos con esas transacciones reales y firmados con el
  **secreto de eventos real**: aprobado → `PAID` con riel `CARD` y payload
  guardado; duplicado → no-op; `DECLINED` fuera de orden → no regresa nada.
- Operativo: la cabecera de `wompi.ts`, la factory y `.env.example` ahora
  dicen la verdad nueva (verificado 2026-08-13, y qué falta). La base local
  quedó en estado demo (`prisma db seed` tras las compras de prueba).

**Lo que queda del Bloque F no es código nuestro:** registrar la **URL de
eventos** en el panel de Wompi (Desarrollo → Programadores → URL de Eventos,
modo prueba) apuntando a un despliegue público
(`https://<host>/api/webhooks/wompi`) para que Wompi entregue él mismo — el
formato del evento y el checksum ya están probados con el secreto real. Para
probarlo en un preview de Vercel: llaves `pub_test_` y
`PAYMENT_PROVIDER=wompi` **solo en Preview**. Production sigue en `mock` hasta
la aprobación del comercio, con llaves `prod_` y su URL de eventos propia.

---

### Sesión anterior — 11 de agosto de 2026 — Páginas legales y adaptador Wompi

**Objetivo: sacar las páginas legales de la ruta crítica de la pasarela.** La
clienta ya tiene sus documentos listos para radicar en Wompi, y el ADR 002 deja
claro que el análisis de riesgo **revisa la tienda en vivo**: radicar contra una
tienda con dos links muertos en el footer y sin política de datos es regalar
semanas.

- **Cuatro páginas nuevas** bajo `/legal/`: tratamiento de datos, términos y
  condiciones, envíos y empaque discreto, y devoluciones/garantía/retracto.
  Enlazadas desde el footer de todas las páginas de la tienda y entre ellas.
- **Registro único en `src/lib/legal.ts`** — el footer, la navegación entre
  legales y las páginas mismas leen de ahí. Renombrar una ruta o corregir la
  identificación del responsable es un solo archivo.
- **La política de datos no es una plantilla.** El artículo 5 de la Ley 1581 de
  2012 clasifica como **sensibles** los datos relativos a la vida sexual, y en
  esta categoría el historial de compras revela justamente eso. La página lo
  dice, dice que el titular **no está obligado** a autorizar su tratamiento, y
  enumera lo que no hacemos con él (ni perfiles, ni publicidad, ni cesión).
  También declara la transferencia internacional (art. 26) — Neon y Vercel están
  en Estados Unidos — y los plazos de consultas (10 + 5 días hábiles) y reclamos
  (15 + 8).
- **El retracto quedó dicho con precisión**, que es la regla de `CLAUDE.md`. El
  artículo 47 de la Ley 1480 de 2011 da 5 días hábiles en venta a distancia,
  **pero el mismo artículo excluye los bienes de uso personal y los que por su
  naturaleza no pueden devolverse** — que es lo que vende esta tienda. La página
  lo explica por el sello de higiene, y aclara que la excepción **no toca la
  garantía legal** (1 año para productos nuevos cuando el fabricante no anuncia
  plazo, arts. 7 y 8). Las excepciones se citan en palabras y no por numeral a
  propósito: un numeral equivocado en una página publicada es peor que no
  numerarla. Se incluye la reversión del pago (art. 51), que aplica justo al
  medio de pago que la pasarela va a habilitar.
- **La tarifa de envío sale de `SHIPPING_CENTS`**, la misma constante que cobra
  el checkout, así que la página publicada y el cobro real no pueden divergir.
  Cuando la clienta confirme su tarifa, cambia una constante y cambian las dos.
- `WHATSAPP_DISPLAY` en `src/lib/contact.ts` — el número como canal de atención
  de habeas data tiene que leerse como un teléfono, no como doce dígitos.
- 9 pruebas nuevas en `src/lib/legal.test.ts`. La que importa: la
  identificación del responsable **nunca sale con un hueco visible** —
  paréntesis vacíos, comas colgando o preposiciones sueltas— con los campos que
  todavía no tenemos.

**Lo único que falta para radicar:** razón social o nombre de la persona
natural, NIT o cédula y domicilio, en `RESPONSABLE` de `src/lib/legal.ts`. Hoy
la política se sostiene sobre el nombre comercial, la ciudad y el WhatsApp real
—todo cierto— pero el art. 13 del Decreto 1377 de 2013 pide la identificación.

**Y la parte pura del adaptador de Wompi** (segunda mitad de la sesión).
`src/payments/providers/wompi.ts` implementa el puerto completo: firma de
integridad del enlace de Web Checkout, verificación del checksum del evento y
mapeo de estados. La factory gana su `case "wompi"` y `.env.example` documenta
las tres llaves.

- **No está verificado contra el sandbox** — este entorno no alcanza
  `sandbox.wompi.co` ni `docs.wompi.co` (el mismo egress restringido que ya
  anotó el ADR 002). El esquema está implementado según lo publicado por Wompi
  y probado contra vectores calculados con `sha256sum`, o sea **la
  implementación es consistente, no que el esquema sea el vigente**. El modo de
  falla es cerrado: un esquema equivocado rechaza el webhook, nunca acepta uno
  falso. Correr una transacción con llaves `pub_test_` antes de prender
  `PAYMENT_PROVIDER=wompi` en cualquier entorno.
- **15 pruebas.** Los digests salen de `sha256sum`, no de la función bajo
  prueba, así que un cambio en el orden de concatenación las rompe — un test
  que rehace el hash con la misma función no atraparía eso. Cubren los ataques
  que importan: estado APPROVED inyectado, monto alterado, timestamp movido,
  propiedad firmada inexistente (si se firmara `undefined` cualquiera podría
  reproducir el hash) y el cruce de secreto de integridad con el de eventos.
- **En Web Checkout no hay id de transacción al crear el pago**, así que
  `providerReference` es nuestra referencia (`orderNumber`) y el id de Wompi
  queda en `rawPayload` para conciliación.
- `amountCents` **ya es** `amount-in-cents`: no se multiplica. Hay una prueba
  que lo fija, porque equivocarse ahí cobra cien veces.

**Lo que falta del Bloque F, y por qué no se hizo acá:** la transición del
pedido en `/api/webhooks/[provider]` sigue siendo el `TODO(sprint-4)`. Es
código que muta stock dentro de una transacción y escribe al libro, y este
contenedor no tiene base de datos —no hay demonio de Docker ni `DATABASE_URL`—
así que no se podría ejecutar ni una vez. `stock.ts` se validó en su día con 8
transacciones concurrentes contra una Postgres real; esta pieza merece lo
mismo. Va en una sesión con base.

Verificado: `tsc`, lint, **128 pruebas** (102 pasan sin base, 26 saltadas),
build con las cuatro páginas legales estáticas, y revisión en navegador real a
1280 y 375 px.

---

### Sesión anterior — 6 de agosto de 2026 — Bloque D

**Objetivo: Bloque D — construirlo, verificarlo y dejarlo corriendo en
producción.** El detalle de lo construido está en el Bloque D de §4; esta
entrada registra lo operativo:

- **Bloque C verificado en local de punta a punta** antes de seguir: migraciones
  y seed contra la Docker local, las 79 pruebas de entonces, y el e2e comprando
  de verdad (pedido `SECRETO-MX9WNK` en la base con reserva, snapshot y fila del
  libro). De paso se encontró y cerró un hueco: `createOrder` descartaba el
  método de pago; ahora contra entrega escribe su fila `Payment` al crear.
- **Bloque D completo en dos mitades** (pedidos con better-auth y máquina de
  estados; productos con opciones, generación de variantes y ajuste de stock en
  dos toques). Al cierre: **104 pruebas unitarias**, 4/4 e2e, lint y build
  limpios.
- **PR #12 mergeado a `main`.** El check de CI murió dos veces **sin ejecutar un
  solo paso** — outage mayor de GitHub Actions ese día ("job was not acquired by
  Runner"), no un fallo del código — así que se mergeó con override de admin;
  la rama estaba verificada completa en local.
- **Neon migrado:** `20260806045334_admin_auth` aplicada con `migrate deploy`
  (solo aditiva: las 4 tablas de better-auth). Historial al día: 4 migraciones.
- **Vercel configurado:** `BETTER_AUTH_SECRET` (secreto propio de producción,
  distinto al local) y `BETTER_AUTH_URL=https://secretxoxo-shop.vercel.app`
  cargadas; el deploy de producción quedó en el commit del merge.
- **Cuenta admin real creada en Neon** (`brayaniselrey09@gmail.com`, vía
  `admin:create` con la contraseña por variable de entorno). **Login contra
  producción verificado**: `POST /api/auth/sign-in/email` devuelve sesión.
- **Nuevo flujo de ramas:** existe `develop`; el trabajo diario va ahí y `main`
  recibe merges desde `develop` (cada push a `main` sigue desplegando solo).
- Las ramas ya mergeadas (`feat/bloque-d-panel-pedidos`, `fix/e2e-port-override`,
  `claude/pasarela-integration-analysis-lj4qt0`) se limpiaron de local y origin.

Deuda operativa de la sesión: el CI de `main` quedó pendiente de re-correr
cuando pase el outage de GitHub, y la base **local** quedó en estado demo — los
~14 productos importados se restauran con `npm run import:promote` (el staging
git-ignored sobrevive).

---

### Sesión anterior — 5 de agosto de 2026 — Bloque C

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
(1) **Font Awesome Free entra como excepción acotada a la regla anti-rellenos**
(2026-08-06) — glifos de marca reales (`faInstagram`/`faWhatsapp`, brands)
reemplazan los stand-ins `Camera`/`MessageCircle` del footer (un logo no se
redibuja en outline), y `faBagShopping` (solid) acompaña "Agregar al carrito"
en la PDP y el modal de la home; alcance documentado en `.font-awesome.md`,
todo lo demás sigue en Lucide; (2) en el footer vino los iconos heredan marfil
como el texto (la regla cuerpo/vino asume superficie clara). Convención
definida: `size-4` inline, `size-5` en controles de ≥44px. El pill de WhatsApp
sigue sin icono (solo su `→`, como manda el handoff).

**Las tarjetas de producto ganaron acciones explícitas (2026-08-06).** El
handoff traía la tarjeta como un único target silencioso; ahora cada tarjeta
cierra con "Agregar" (variante única, `faBagShopping`, feedback de check 2 s
sin cambiar el tamaño del botón) o "Elegir opciones" (ruta a la PDP), más
"Ver detalle" en contorno — media y nombre conservan su comportamiento
(modal en la home, PDP en el catálogo). Los sellos de categoría cambiaron la
inicial por iconos Lucide outline (`Shirt`/`Droplets`/`Sparkles`, mapeo por
slug con fallback a la inicial), y las imágenes de tarjeta, modal y galería
pasaron a `object-contain object-center` para que cualquier foto no-4:5 se
vea completa y centrada. Extensión visible del diseño de Fase 0: señalarla en
la siguiente vista previa a la clienta.

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

**Desplegado (2026-08-06):** mergeado a `main`, migración `admin_auth` en Neon,
`BETTER_AUTH_SECRET` + `BETTER_AUTH_URL` en Vercel y la cuenta admin real creada.
Login verificado contra https://secretxoxo-shop.vercel.app/admin/login. Ojo en
local: `BETTER_AUTH_URL` tiene que coincidir con el origen real (el dev server
propio corre en 3001) o la cookie de sesión se emite para otro host y el login
entra en bucle sin error.

### Bloque I — La clienta cura desde el panel ✅ hecho (2026-08-13)

Fotos de producto desde el panel (celular y desktop) a Cloudinary con
`public_id` por contenido y derivadas sin EXIF; staging de proveedores en
Postgres (`SupplierStagingProduct` + `npm run import:stage`); curador en
`/admin/proveedores` cuyo **Publicar** corre el mismo
`src/features/import/promote-core.ts` que el CLI; archivar/restaurar de un
toque con borrado real solo sin historia (guard en transacción); dashboard de
ventas en `/admin` con la definición de venta visible. Detalle completo en §3.
`CLOUDINARY_URL` ya está en Vercel. **Espera deploy:** `migrate deploy` en
Neon y `import:stage -- --neon`.

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
idempotente con guardarraíl anti-Neon. **El Bloque I movió el núcleo del
promote a `src/features/import/` y puso la curaduría en `/admin/proveedores`**
— la clienta ya no necesita esta máquina ni `seleccion.json` para publicar
(el CLI sigue vivo para lotes). Abierto: que ella **ejecute** su curaduría y
decida el **margen por categoría** (los defaults del panel son los de
trabajo: +50 % DistriSex, +0 % Climax).

### Bloque F — Pagos 🔄 verificado contra el sandbox; Production espera el comercio

La aprobación de la cuenta de comercio sigue siendo calendario, no código. Ver
`docs/decisions/001-payment-provider.md` y, para la comparación completa,
**`docs/decisions/002-pasarela-wompi-vs-payu.md`**.

**Estado al 13 de agosto de 2026:**

| Pieza                                   | Estado                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Puerto `PaymentProvider` + `MockProvider` | ✅ desde Fase 0                                                                                              |
| Adaptador Wompi (firma, checksum, estados) | ✅ **verificado contra el sandbox** — firma de integridad (con expiración) confirmada con transacciones reales; ver §3 |
| Arranque del pago (`createOrder` → enlace firmado → redirect) | ✅ con reserva de 30 min y enlace que expira con ella                                       |
| Transición del pedido en el webhook     | ✅ `PENDING→PAID` vía la máquina de estados, idempotente bajo concurrencia; el stock se compromete al enviar, una sola vez |
| Página de retorno `/checkout/gracias`   | ✅ confirmando / confirmado / rechazado con reintento / expirado / registrado                                |
| URL de eventos en el panel de Wompi     | ⬜ **el único paso técnico restante** — Desarrollo → Programadores, modo prueba, apuntando a `https://<host>/api/webhooks/wompi`; llaves de prueba solo en Preview |
| Cuenta de comercio                       | ⬜ existe en modo prueba ("SECRETO BTQ"); lista para radicar en cuanto se llene `RESPONSABLE` y se despliegue |
| Descriptor `SECRETO BTQ`                 | ⬜ se confirma con la pasarela en el onboarding                                                              |

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
los 30 días de la primera venta**—; y las páginas legales publicadas y accesibles.

**Estado al 11 de agosto de 2026:** la clienta ya tiene sus documentos listos, y
las **páginas legales quedaron publicadas** — el bloqueante de nuestro lado se
cerró. Falta llenar `RESPONSABLE` en `src/lib/legal.ts` (razón social o nombre,
NIT o cédula, domicilio) y desplegar antes de radicar, porque el análisis de
riesgo revisa la tienda en vivo. El descriptor `SECRETO BTQ` —que el checkout ya
le anuncia al comprador y los términos publican— se confirma con la pasarela
durante el onboarding.

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
| Autenticación admin  | ✅ **better-auth** — sesión por correo y contraseña, registro deshabilitado, cuentas por `npm run admin:create`. Variables cargadas en Vercel y login verificado contra producción              |

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
| ~~Admin a medias~~ ✅                         | Saldada: Bloque D completo y en producción — pedidos y productos, con el ajuste de stock escribiendo al libro. Ver Bloque D                                                                                                                |
| CI de `main` sin re-correr                   | El merge de Bloque D entró durante un outage mayor de GitHub Actions (el job nunca obtuvo runner). Re-correr el workflow de `main` cuando pase, o dejar que el siguiente push lo cubra — el código está verificado en local               |
| ~~Pago en línea sin registrar en el pedido~~ ✅ | Saldada en Bloque F: el arranque escribe la fila `Payment` (`method` null hasta que el evento reporte el riel) y el webhook la resuelve. Ver §3                                                                                                                                |
| URL de eventos de Wompi sin registrar        | El webhook está probado con eventos firmados con el secreto real, pero Wompi solo entrega a la URL cargada en su panel (Desarrollo → Programadores, modo prueba): `https://<host>/api/webhooks/wompi`. Sin eso, los pedidos online quedan `PENDING` hasta que una asesora los marque. Para probar en Vercel: llaves `pub_test_` y `PAYMENT_PROVIDER=wompi` **solo en Preview** |
| Fotos propias pendientes                     | Los importados ya muestran la foto del proveedor vía Cloudinary; el demo sigue en placeholder. La sesión propia (arena, luz cálida) queda para lo que no tenga foto usable — ver Bloque E                                                 |
| Descripciones sin pasada editorial           | El promote guarda la descripción del proveedor limpiada de HTML. El tono clínico SECRETO (material, medidas, cuidado) es una pasada editorial por producto que nadie ha hecho — ahora editable desde el panel, y el formulario ya lo recuerda con su hint                                                             |
| Bloque I sin desplegar                       | Todo verificado en local y `CLOUDINARY_URL` ya cargada en Vercel. Para que la clienta lo use de verdad faltan dos pasos post-merge: `migrate deploy` en Neon (aditiva) y `npm run import:stage -- --neon`. Ver §3                                                                                                       |
| Video de producto sin flujo de subida        | `ProductMedia` soporta VIDEO con `posterUrl` y el panel lo mostraría, pero la subida del panel acepta solo imágenes (un video excede el presupuesto de una Server Action). Cuando haya videos reales: subida firmada directa a Cloudinary o límite mayor, con posterUrl generado                                        |
| Foto por color sin gesto en el panel         | `ProductMedia.optionValueId` existe y el import lo escribe (fotos Shopify atadas a color), pero el gestor de fotos del panel no ofrece asignar una foto a un valor de opción. Se agrega cuando la clienta lo pida                                                                                                       |
| Staging huérfano tras seed local             | `prisma db seed` borra productos y deja filas de staging PUBLISHED apuntando a nada (FK en null). Solo pasa en la local; `import:stage` re-alinea y el curador lo muestra como publicado sin enlace. Cosmético                                                                                                          |
| Assets de Cloudinary best-effort al borrar   | Quitar foto / borrar producto destruye el asset del panel solo si nada lo referencia, y un fallo de red deja un huérfano (se loguea). Costo: almacenamiento, nunca correctitud                                                                                                                                          |
| Curaduría y margen: decisión de negocio      | `seleccion.json` trae 14 productos de demostración y márgenes de trabajo (+50 % DistriSex, +0 % Climax). La clienta decide el subconjunto real (con `revision.html`) y el margen por categoría — ver §6                                   |
| Enmienda de movimiento sin aprobar           | El escaparate del héroe y la entrada escalonada extienden el spec de movimiento del handoff (que solo define hovers de 150–200 ms). Valores en `globals.css` como `--motion-*`; se aprueban con la Fase 0 o se apagan quitando dos clases |
| ~~Páginas legales inexistentes~~ ✅           | Saldada (2026-08-11): las cuatro existen bajo `/legal/` y están enlazadas desde el footer de todo el sitio. El retracto quedó dicho con precisión —el art. 47 de la Ley 1480 excluye los bienes de uso personal— sin tocar la garantía legal. Ver §3                                                                                     |
| ~~Identificación del responsable~~ ✅         | Saldada: nombre y NIT salen de `LEGAL_RAZON_SOCIAL` y `LEGAL_NIT` en Vercel, no del repo — que es público. Verificado en el build: la página publica "SECRETO · antes XOXO (…, NIT …), con domicilio en Medellín, Antioquia, Colombia"                                                                                                 |
| Variables legales sin guardarraíl             | Si `LEGAL_RAZON_SOCIAL` o `LEGAL_NIT` faltan, la página **no falla**: degrada a nombre comercial + ciudad. Un despliegue sin ellas se ve bien y está incompleto. Hoy se cubre con documentación; un chequeo en el build sería más honesto                                                                                              |
| Dirección de notificación inexistente         | `LEGAL_DOMICILIO` va vacío a propósito: la tienda es virtual y la única dirección es la vivienda del titular. La identificación se sostiene sobre ciudad + canales. Si la pasarela o un requerimiento exigen dirección publicada, la salida es una oficina virtual o la del contador                                                    |
| ~~Correo comercial inexistente~~ ✅           | Saldada: `SUPPORT_EMAIL` en `src/lib/contact.ts` (`soporte.secretobtq@gmail.com`), visible en el footer y publicado como canal de habeas data en la política de datos y en los términos                                                                                                                                               |
| Facturación siendo no responsable de IVA      | El RUT trae la responsabilidad **49 — No responsable de IVA**, así que los términos ya no afirman que el precio incluya IVA. Falta confirmar con el contador si factura electrónicamente o con documento equivalente; puede cambiar una línea de `/legal/terminos`                                                                     |
| Tarifa de envío publicada = supuesto          | `/legal/envios` publica `SHIPPING_CENTS` ($12.000), que sigue siendo el supuesto del handoff. Página y cobro no pueden divergir —leen la misma constante— pero el número sigue esperando a la clienta (§6)                                                                                                                            |
| Remitente del empaque sin definir             | La política de envíos promete un remitente neutro que no menciona la tienda ni la categoría. Es cierto y es lo decidido; la cadena exacta impresa en la guía la elige la clienta (§6)                                                                                                                                                 |
| Spec §7 y §9 desfasados                       | El plan de entrega dice que las Fases 2 y 4 "no empezaron"; Bloques C y D están en producción desde el 6 de agosto. Solo documentación, pero es el documento que alguien nuevo lee primero                                                                                                                                            |
| `mediaForSelection` sin cablear              | Fotos por color elegido: implementado y testeado, pero conectar la galería al picker exige reestructurar el PDP en isla cliente (hoy `Gallery` y `PurchasePanel` son hermanos server). Evaluado y diferido                                |
| Icono Mail de la asesoría sin destino        | Ya existe correo del negocio y está en el footer, pero el bloque de asesoría de la home sigue con el icono decorativo y su formulario de newsletter. Revisarlo cuando se defina si el newsletter se conecta a algo                        |
| `package.json` sigue llamándose `xoxo-store` | Cosmético, sin urgencia. El repo también. Solo importa lo que ve el cliente                                                                                                                                                               |
| Lighthouse sin medir                         | El criterio de éxito del spec (≥ 90 móvil) no se ha verificado; medirlo con imágenes reales, no con placeholders                                                                                                                          |
| Descriptor de pago sin acordar               | `SECRETO BTQ` es la propuesta del handoff; hay que confirmarla con la pasarela en el onboarding                                                                                                                                           |

---

## 6. Lo que hay que preguntarle a la clienta

Estas bloquean decisiones técnicas, no son de diseño. La lista completa está en el spec
§11; estas son las que bloquean el trabajo inmediato:

1. **Curaduría del catálogo** — ya no exige sentarse con nadie: entra a
   `/admin/proveedores` (desde el celular si quiere) y publica lo que vende
   de los 1.275, con su precio. El permiso de los proveedores ya está
   resuelto; las fotos fluyen solas al publicar. Solo falta que el Bloque I
   esté desplegado (§3) y contarle que existe.
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
