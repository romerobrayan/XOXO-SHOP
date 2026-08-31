# Pruebas y auditoría — SECRETO

> **Por qué existe este documento.** El plan de entrega del spec (§7) va de la Fase 0 a la
> Fase 4 y nunca define una fase de verificación. Los criterios de éxito de v1 (§ "Success
> criteria") piden cosas medibles —Lighthouse ≥ 90, descriptor neutro, stock que baja
> solo— pero ningún documento decía **quién las mide, cómo, ni con qué se aprueba**.
> Eso se saldó acá.
>
> Esto no es burocracia. Esta tienda cobra dinero, guarda cédulas y direcciones de
> personas, y vende en una categoría donde una filtración no es una molestia: es un daño
> personal. La verificación es parte del producto, igual que la discreción.

- Estado vivo del proyecto: `docs/ESTADO-Y-SIGUIENTE-SESION.md`
- Reglas de ingeniería que estas pruebas defienden: `CLAUDE.md`
- Especificación: `docs/XOXO_TECHNICAL_SPEC.md`

---

## 1. De dónde partimos

No partimos de cero, y el documento sería deshonesto si lo insinuara. Lo que **ya**
está verificado, con nombre propio:

| Frente | Qué lo cubre hoy |
| --- | --- |
| Suite automatizada | **182 pruebas** unitarias/integración (`npm run test`) + **7 e2e** de Playwright |
| CI | `.github/workflows/ci.yml` — lint, migraciones, seed, suite completa y build contra un **Postgres real** en cada push y PR |
| Concurrencia de stock | `stock.test.ts`: *"lets exactly one of N concurrent buyers win the last unit"* — carrera real, no simulada |
| Idempotencia de pagos | `payment-events.test.ts`: *"8 concurrent deliveries of the same approval: exactly one wins"*, más reintentos y entregas fuera de orden |
| Firma de la pasarela | `wompi.test.ts` — firma de integridad y checksum de eventos, confirmados contra el sandbox real |
| Autorización del panel | **Las 18 Server Actions del panel llaman `requireStaff()`**, verificado una por una. `createOrder` no la lleva a propósito: el guest checkout es obligatorio |
| Protección del cron | `/api/cron/release-reservations` exige `Authorization: Bearer $CRON_SECRET`, responde 401 sin él |
| Firma del webhook | El route handler rechaza con 400 si `verifyWebhook` no valida |
| Paridad sin base de datos | `parity.test.ts` prueba que fixtures y Postgres sirven DTOs idénticos |
| Sin rastreadores | Cero scripts de terceros en el código. La política de privacidad lo promete y el repo lo cumple |

**Lo que eso no cubre** es lo que ordena el resto de este documento.

---

## 2. Los seis frentes

Cada frente declara **qué se revisa**, **cómo se verifica** y **con qué se aprueba**. Un
frente sin criterio de aprobación es una opinión, no una auditoría.

### A. Seguridad de aplicación

| Qué se revisa | Cómo | Aprueba cuando |
| --- | --- | --- |
| Autorización de cada Server Action | Recorrer `src/features/*/actions.ts` y confirmar `requireStaff()` en toda acción de panel | Ninguna acción de panel sin guarda. `createOrder` es la única excepción documentada |
| Escalamiento por parámetro | Intentar editar/borrar recursos ajenos cambiando el id en la petición | El servidor rechaza; nunca confía en el id que llega |
| Manipulación de precios | Enviar `expectedPriceCents` y `shippingZoneId` falsos al checkout | El servidor re-lee de la base y rechaza. Ya cubierto por prueba; re-verificar en cada cambio del checkout |
| Abuso de rutas públicas | Golpear `createOrder`, el webhook y el login en ráfaga | **Hallazgo abierto — ver §3.1** |
| Cabeceras de seguridad | Inspeccionar respuestas de producción | **Hallazgo abierto — ver §3.2** |
| Secretos | `git log -p` en busca de llaves; revisar que `.env*` siga ignorado | Ningún secreto en el historial. Las llaves de Wompi solo en Preview hasta que el comercio apruebe |
| Dependencias | `npm audit` y revisión de las vulnerabilidades altas | Sin vulnerabilidades altas explotables desde la superficie de la tienda |
| Subida de archivos | Subir un archivo que no es imagen, uno de 20 MB, y uno con EXIF/GPS | Zod rechaza tipo y tamaño; las derivadas no exponen EXIF (ya probado en `media.cloudinary.test.ts`) |

### B. Dinero e inventario

El frente donde un error no se ve y sí se cobra.

| Qué se revisa | Cómo | Aprueba cuando |
| --- | --- | --- |
| Nunca vender lo que no hay | Prueba de concurrencia existente + una compra real del último artículo | Exactamente un comprador gana; el resto recibe conflicto, no un pedido fantasma |
| El ledger cuadra | `InventoryMovement` sumado contra `stockOnHand` de cada variante | Cero descuadres. `parity.test.ts` ya lo reconcilia |
| Dinero siempre en centavos | Buscar `Float`/`parseFloat` sobre montos; revisar todo `priceCents`/`shippingCents` | Ningún flotante toca dinero (CLAUDE.md regla 1) |
| El total mostrado = el total cobrado | Comparar el Resumen del checkout contra `Order.totalCents` en la base, incluido el domicilio por zona | Coinciden al peso, en zona específica, general y nacional |
| Snapshots inmutables | Cambiar precio y nombre de un producto ya vendido | El pedido histórico no se altera (`OrderItem`, `Order.shippingZoneName`) |
| Reservas que vencen | Dejar vencer una reserva de contra entrega y de pago en línea | El stock vuelve solo; el pedido queda cancelado, no colgado |

### C. Privacidad, cumplimiento y discreción

En esta categoría el dato de compra es **dato sensible** (Ley 1581 de 2012 y su
Decreto 1377 de 2013). Este frente no es opcional.

| Qué se revisa | Cómo | Aprueba cuando |
| --- | --- | --- |
| Minimización de datos | Inventariar todo campo personal que se guarda y por qué | Cada campo tiene justificación (factura, guía, contacto). **La puerta 18+ no guarda fecha de nacimiento** |
| Promesas de la política vs. realidad | Leer `/legal/privacidad` línea por línea contra el código | Todo lo prometido es cierto: sin rastreadores, sin perfilamiento, sin venta de datos |
| Discreción del empaque y el cobro | Revisar guía, remitente y descriptor de la pasarela | Ninguno menciona la tienda ni la categoría |
| Discreción en notificaciones | Revisar asunto, remitente y vista previa del correo de confirmación | **Sin construir todavía** — el correo no puede llevar nombres ni fotos de producto (CLAUDE.md) |
| Habeas data operable | Ejercer una solicitud de consulta y una de supresión como si fueras cliente | Hay un canal publicado y alguien sabe responderlo dentro del plazo legal |
| Retención | Definir cuánto se guarda una dirección de invitado | Hay una política escrita, no un "para siempre" por omisión |
| Puerta 18+ | Primera visita en incógnito | Aparece, es descartable, guarda solo booleano + marca de tiempo |

### D. Accesibilidad

El spec pide foco visible y `prefers-reduced-motion` respetado; nadie lo ha verificado.

| Qué se revisa | Cómo | Aprueba cuando |
| --- | --- | --- |
| Recorrido por teclado | Comprar de punta a punta sin tocar el mouse | Se puede completar. El foco siempre visible, nunca atrapado en el modal de la puerta 18+ |
| Lector de pantalla | Recorrer catálogo, ficha y checkout con VoiceOver o NVDA | Precio, disponibilidad y errores se anuncian. Las fotos pendientes se anuncian como pendientes |
| Contraste | Auditar los tokens de marca sobre marfil y crema | Texto ≥ 4.5:1. Ojo con el **oro `#C9A96E`**: sirve de acento, no de texto |
| Movimiento | Activar "reducir movimiento" en el sistema | La entrada escalonada y el escaparate se apagan |
| Formularios | Revisar el Paso 2 del checkout | Toda etiqueta asociada, todo error asociado a su campo. **Ojo:** hoy la nota de ayuda vive dentro del `<label>` y se pega al nombre accesible del campo |

### E. Rendimiento

| Qué se revisa | Cómo | Aprueba cuando |
| --- | --- | --- |
| Lighthouse móvil | Correr contra producción **con fotos reales**, no con placeholders | ≥ 90 en rendimiento. Es criterio de éxito del spec |
| Peso de las imágenes | Revisar lo que entrega Cloudinary en tarjeta y galería | La transformación de marca aplica; nada sirve el original |
| Consultas a la base | Revisar las páginas dinámicas nuevas (`/checkout`, `/legal/envios`) | Sin N+1; las zonas se leen una vez por render |
| Tiempo hasta el catálogo | Medir `/tienda` desde móvil en 4G | Coherente con el 0,46–0,67 s ya medido en producción |

### F. Operación y recuperación

| Qué se revisa | Cómo | Aprueba cuando |
| --- | --- | --- |
| Restaurar la base | Restaurar una copia de Neon a un punto anterior, de verdad | Se logra, y está cronometrado. Una copia sin restaurar probada no es una copia |
| Orden de migración | Simular despliegue de código sin migración | Se conoce el síntoma y el remedio. **Las zonas de domicilio ya exigen `migrate deploy` antes del código** |
| El cron corre | Verificar que el liberador de reservas se ejecuta en Vercel | Corre en el plan contratado, o hay respaldo consciente |
| Webhook en producción | Registrar la URL de eventos en el panel de Wompi y enviar uno de prueba | Llega, valida y liquida el pedido una sola vez |
| Qué hacer si se cae la pasarela | Documentar el plan | Contra entrega y WhatsApp siguen vendiendo sin tocar código |

---

## 3. Hallazgos abiertos

Detectados al levantar este documento. Ninguno es teórico: los verifiqué en el repo.

### 3.1 Sin límite de tasa en ninguna ruta pública — **alto**

No hay rate limiting en el proyecto. `createOrder` es una ruta **pública, sin sesión,
que escribe en la base y reserva inventario**. Un script puede agotar el stock de la
tienda sin pagar un peso, y la reserva de contra entrega dura 72 horas.

**Propuesta:** límite por IP en `createOrder` y en el login del panel. La reserva
corta ya existe para el pago en línea; el hueco real es contra entrega.

### 3.2 Sin cabeceras de seguridad — **medio**

`next.config.ts` solo configura `bodySizeLimit`. No hay CSP, ni HSTS, ni
`X-Frame-Options`, ni `Referrer-Policy`. En una tienda cuya promesa es la discreción,
`Referrer-Policy` importa más de lo normal: sin ella, la URL del producto que alguien
estaba viendo viaja al siguiente sitio.

**Propuesta:** empezar por `Referrer-Policy: strict-origin-when-cross-origin`,
`X-Content-Type-Options`, `X-Frame-Options` y HSTS. La CSP va después y con cuidado:
tiene que dejar pasar Cloudinary y las tipografías.

### 3.3 Superficies sin ninguna prueba — **medio**

| Superficie | Archivos | Pruebas | Por qué importa |
| --- | --- | --- | --- |
| `features/age-gate` | 2 | 0 | Es un requisito de cumplimiento sin una sola prueba |
| `features/cart` | 3 | 0 | Incluye la migración de `localStorage` a `version: 1`, que corre en navegadores reales |
| `features/admin` | 5 | 0 | Es la guarda de sesión de todo el panel |
| `app/api` | 3 | 0 | Los handlers en sí; la lógica que llaman sí está probada |

### 3.4 Lighthouse nunca medido — **medio**

Criterio de éxito del spec, sin verificar ni a favor ni en contra. Medirlo con
placeholders daría un número que no sirve: espera a la fotografía real.

### 3.5 Sin revisión de accesibilidad — **medio**

Nadie ha recorrido la tienda con teclado ni con lector de pantalla. Detalle concreto ya
detectado: en los formularios del panel la nota de ayuda va **dentro** del `<label>`, así
que se concatena al nombre accesible del campo ("Tipo Ubicaciones específicas Los
barrios o municipios…"). Se arregla con `aria-describedby`.

---

## 4. Checklist de lanzamiento

La puerta de "sí sale" / "no sale". **Todo lo bloqueante en verde o no se abre la
tienda.** Se llena con fecha y nombre, no de memoria.

**Bloqueante**

- [ ] Migraciones aplicadas en Neon y el esquema coincide con el código
- [ ] Una compra real de punta a punta, con dinero real, cobrada correctamente
- [ ] Total mostrado = total cobrado, en las tres clases de zona de domicilio
- [ ] Stock baja y el ledger cuadra después de esa compra
- [ ] Descriptor de pago confirmado con la pasarela y verificado en un extracto real
- [ ] Empaque y remitente verificados en un envío real
- [ ] Puerta 18+ funcionando en incógnito
- [ ] Páginas legales publicadas y ciertas, con el responsable identificado
- [ ] Canal de habeas data operativo y con alguien que responda
- [ ] Copia de seguridad restaurada de prueba, con tiempo medido
- [ ] Límite de tasa en `createOrder` y en el login (§3.1)
- [ ] Cabeceras de seguridad desplegadas (§3.2)
- [ ] Correo de confirmación con asunto neutro, sin nombres ni fotos de producto
- [ ] `npm run test`, `npx tsc --noEmit`, `npm run lint` y `npm run build` en verde

**No bloqueante, pero se lanza sabiendo el número**

- [ ] Lighthouse móvil ≥ 90 con fotos reales
- [ ] Recorrido de compra completo por teclado
- [ ] Recorrido con lector de pantalla
- [ ] `npm audit` sin vulnerabilidades altas explotables
- [ ] Dominio propio apuntando a Vercel

---

## 5. Cadencia

Auditar una vez antes de lanzar y nunca más es teatro. Lo que sostiene esto:

| Cuándo | Qué corre | Quién |
| --- | --- | --- |
| Cada push y PR | Lint, migraciones, suite completa y build contra Postgres real | CI, automático |
| Cada PR que toque dinero, stock o datos personales | Los frentes **B** y **C** de este documento, a mano | Quien revisa el PR |
| Antes de lanzar | El checklist completo del §4 | Responsable de lanzamiento |
| Cada trimestre, y tras cualquier cambio de pasarela | Frentes **A**, **C** y **F** completos | Responsable técnico |
| Cuando lleguen las fotos reales | Frente **E** (Lighthouse) y frente **D** | Responsable técnico |

---

## 6. Lo que este documento no resuelve

Honestidad sobre sus límites, para que nadie lo lea como una garantía:

- **No es una prueba de penetración.** Cuando haya dinero real fluyendo, una revisión
  externa vale lo que cuesta. Este documento reduce la superficie, no la elimina.
- **No sustituye la revisión de la pasarela.** Wompi y PayU hacen su propio análisis en
  el onboarding, y su criterio manda sobre el nuestro.
- **Los frentes C y D necesitan personas, no scripts.** Un lector de pantalla y una
  solicitud real de habeas data no se automatizan; se hacen.
