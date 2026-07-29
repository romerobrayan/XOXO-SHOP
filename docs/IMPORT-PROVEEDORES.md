# Importación del catálogo desde proveedores

La clienta no tiene catálogo propio: todo sale de las webs de sus dos
proveedores, que **ya autorizaron** usar sus fotos y datos. Este documento es
el runbook del pipeline que los trae al modelo del proyecto.

**El principio que ordena todo: curaduría antes que volcado.** Los proveedores
publican 1.275 productos; la clienta vende un subconjunto. El pipeline baja
todo a un área de *staging* (archivos JSON git-ignored), la selección se hace
sobre esa staging, y solo lo aprobado toca el catálogo real.

```
fetch  →  data/import/staging-*.json  →  revisión (HTML local)  →  seleccion.json  →  promote
          (todo el proveedor)             (la clienta marca)       (commiteado)        (solo lo aprobado)
```

---

## 1. Las dos fuentes

| | DistriSex Colombia | Climax |
| --- | --- | --- |
| Plataforma | WooCommerce — Store API pública | Shopify — `/products.json` público |
| Endpoint | `/wp-json/wc/store/v1/products?per_page=100&page=N` | `/products.json?limit=250&page=N` |
| Tamaño (jul 2026) | ~900 productos, 9 páginas | ~376 productos, 2 páginas |
| robots.txt | permite `/wp-json/` | permite `/products.json` |
| Rol comercial | **mayorista** — su precio es de compra | **competidor minorista** en Medellín — su precio es de vitrina |
| Opciones | `attributes[].has_variations: true` | `options` + `variants` |
| Specs | `attributes[].has_variations: false` (incluye registro INVIMA) | no expone atributos estructurados |
| Marca | atributo "Marca" por producto | `vendor` casi siempre es el default de Shopify ("My Store") — se detecta en título/tags |
| Precio por variante | **no viene en el listado** — si `price_range` existe, el promote pide cada variación | viene completo |
| Dato curioso | `short_description` a veces trae "Precio sugerido" (retail sugerido del mayorista) — se conserva como pista | todas las fichas tienen foto |

Ninguna fuente requiere scraping de HTML. Las peticiones van con rate limit
(700 ms por host), User-Agent identificable y reintentos solo donde sirven
(5xx/red). Woo entrega los precios en unidades menores con
`currency_minor_unit: 0` para COP — el factor a centavos es `10^(2-minor)`.

Nota: el robots.txt de Climax menciona un endpoint UCP/MCP para agentes de
*compra*. No aplica: esto es lectura de catálogo con permiso del proveedor,
por el endpoint público estándar de integraciones.

## 2. Comandos, en orden

```bash
npm run import:check          # preflight Cloudinary: sube un pixel, lo entrega
                              #   transformado, lo borra. Corre esto antes de un lote.
npm run import:distrisex      # baja y normaliza → data/import/staging-distrisex.json
npm run import:climax         # ídem → data/import/staging-climax.json
npm run import:revision       # genera data/import/revision.html (curaduría visual)
npm run import:promote        # SOLO lo aprobado → Cloudinary + base LOCAL
```

Todo corre con `tsx`; nada de esto es una capa REST (regla de CLAUDE.md — los
Server Actions siguen siendo la única interfaz de la app). Los fetch aceptan
`-- --limit N` para pruebas; el promote acepta `-- --refs a,b`,
`-- --update-prices` y `-- --neon`.

## 3. El flujo de selección

1. `npm run import:revision` y abrir `data/import/revision.html` en el
   navegador. Es una página local autocontenida con los 1.275 productos:
   foto, nombre, precio del proveedor, precio de venta propuesto, filtros por
   proveedor/categoría/búsqueda.
2. Marcar "Vender en SECRETO" en lo que la clienta realmente vende. Ajustar
   ahí mismo precio, categoría, marca o stock inicial si hace falta.
3. "Exportar selección" → copia el array `approved` → pegarlo en
   `scripts/import/seleccion.json` (ese archivo **sí** se commitea: es la
   decisión de curaduría).
4. `npm run import:promote`.

La página muestra las fotos hotlinkeadas del proveedor **solo para curar** —
es una herramienta local git-ignored. La tienda jamás hotlinkea: lo aprobado
se re-hospeda en Cloudinary.

## 4. Precios

El precio del proveedor se guarda como **referencia** (`supplierPriceCents` en
staging), nunca como precio de venta. El precio de venta sale de
`seleccion.json`:

- `salePriceCOP` por producto (pesos completos) — gana siempre; o
- `pricing.marginPct` por proveedor sobre el precio del proveedor, redondeado
  **hacia arriba** a `roundUpToCOP`.

Defaults de trabajo: DistriSex +50 % (mayorista → retail), Climax +0 %
(igualar la vitrina del competidor). **El margen real por categoría es una
decisión de la clienta que sigue pendiente** — está anotada en
`docs/ESTADO-Y-SIGUIENTE-SESION.md`.

En re-corridas el promote **no toca precios existentes** (la clienta pudo
haberlos ajustado); `-- --update-prices` re-aplica la regla explícitamente.

## 5. Idempotencia — el contrato

La clave es `Product.supplierRef`, namespaced: `distrisex:<id-woo>` /
`climax:<handle-shopify>`. Re-correr el promote:

| Qué | Comportamiento |
| --- | --- |
| Producto | actualiza nombre/descripción/marca/categoría/specs — **nunca duplica** |
| Slug | se mantiene (es URL pública) |
| Variantes | matchean por `optionKey`; las nuevas se crean, las existentes se conservan |
| Precios | solo al crear (o con `--update-prices`) |
| Stock | **jamás se toca en updates**. `initialStock` aplica por variante, solo al crear, y entra por `InventoryMovement` (`PURCHASE`) en la misma transacción — regla 3 de CLAUDE.md |
| Opciones/valores | aditivos — nunca se borra un valor (tiene variantes colgando) |
| Imágenes | un asset por URL de origen (public_id determinista por hash); una fila `ProductMedia` por URL de entrega; re-correr no re-sube |

## 6. Imágenes y Cloudinary

- Los bytes se **descargan del proveedor y se suben a Cloudinary** — nunca al
  repo, nunca hotlink (CLAUDE.md).
- `public_id`: `secreto/productos/<proveedor>/<sha1(url-sin-query)[0:16]>` —
  determinista, así el mismo origen siempre mapea al mismo asset
  (`overwrite: false`).
- La URL guardada en `ProductMedia.url` ya trae la transformación de la guía
  de marca: `c_pad,ar_4:5,b_rgb:F1E7D8,f_auto,q_auto` — 4:5 sobre fondo
  arena. Las fotos de proveedor vienen sobre blanco; con esto el Bloque E deja
  de necesitar preprocesamiento manual.
- Imágenes que Shopify ata a variantes de un color se guardan con
  `ProductMedia.optionValueId` → la galería puede mostrar la foto del color
  elegido.
- Tope de 8 imágenes por producto (el excedente queda avisado en consola).
- Credencial: `CLOUDINARY_URL` en `.env` (ver `.env.example`). El secret no va
  al repo ni a los logs; `npm run import:check` valida sin imprimirlo.

## 7. Bases de datos — el guardarraíl

El promote corre **contra la local de Docker** por defecto
(`docker compose up -d --wait` primero). Si la URL resuelta apunta a
`neon.tech` sin `--neon`, **se niega**. `--neon` es para un solo momento: la
staging aprobada por la clienta, lista para publicarse en la base que ve el
despliegue.

`IMPORT_DATABASE_URL` existe para una local no estándar (p. ej. puerto 5433),
no para apuntar a Neon por la puerta de atrás.

**Efecto secundario conocido:** después de importar en la local, las 6 pruebas
de paridad fixtures ↔ Postgres fallarían contra esa base (tiene más productos
que los fixtures — es exactamente lo esperado). No es problema: `npm run test`
lee `DATABASE_URL` de `.env` (Neon, con el demo intacto) y la paridad pasa.
Para devolver la local al estado demo: `npx prisma db seed` (el guardarraíl
`SEED_ALLOW_ORDER_WIPE` sigue intacto y este pipeline no lo toca).

## 8. Qué queda pendiente (negocio, no código)

1. **Margen por categoría** — los `marginPct` actuales son defaults de
   trabajo. Lo decide la clienta.
2. **Qué subconjunto vende realmente** — `seleccion.json` hoy trae 14
   productos de demostración que ejercitan todos los caminos del pipeline; la
   curaduría real es de ella (con `revision.html`).
3. Redacción editorial: las descripciones llegan del proveedor tal cual
   (limpiadas de HTML). El tono clínico SECRETO es una pasada editorial
   posterior, producto a producto.

El permiso de los proveedores para usar fotos y datos **ya está resuelto** —
no es un pendiente.
