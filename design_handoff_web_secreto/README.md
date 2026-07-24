# Handoff: Web e-commerce SECRETO · Boutique Erótica

## Overview
Tienda e-commerce para SECRETO (rebrand de "XOXO Sex Shop"), tienda colombiana de productos para adultos que vende por Instagram y WhatsApp, con envíos en Colombia y contra entrega en Medellín. La promesa central de la marca es la **discreción** ("El placer es tuyo. El secreto, nuestro.") y debe reforzarse en cada punto del flujo. Este paquete contiene el design system completo y 4 páginas de referencia: home, catálogo, detalle de producto y checkout.

## About the Design Files
Los archivos en `paginas/` son **referencias de diseño creadas en HTML** — prototipos que muestran el look y comportamiento buscado, NO código de producción para copiar directo. La tarea es **recrear estos diseños en el entorno del proyecto real** (Next.js, Astro, React, Shopify/Liquid, o el framework que se elija si aún no existe) usando sus patrones y librerías. Excepción: `design_system/styles.css` y `design_system/tokens/*.css` SÍ son consumibles directamente — son los tokens y clases oficiales del sistema.

## Fidelity
**High-fidelity (hifi).** Colores, tipografía, espaciado, copy e interacciones son finales. Recrear pixel-perfect. Únicas partes provisionales: las zonas rayadas de imagen (placeholders a reemplazar por fotos reales de producto en proporción 4:5) y el logo (tipográfico por ahora; vectorización pendiente).

## Screens / Views

### 1. Home (`paginas/index.html`)
- **Barra anuncio**: fondo `#5C1A2E`, texto marfil 13.5px centrado: "Envíos discretos en toda Colombia · Contra entrega en Medellín".
- **Header sticky**: fondo `#FFFDF9`, borde inferior 1px `#E2D5C2`. Tres zonas: nav izquierda (Lencería/Juguetes/Bienestar, 13.5px medium), wordmark centrado (Marcellus 26px, tracking 0.25em, uppercase, vino), derecha Asesoría + Bolsa con badge contador vino.
- **Héroe**: grid 1.1fr/1fr, gap 64px, padding vertical 96px, degradado 170° crema→arena. Izquierda: kicker "BOUTIQUE ERÓTICA · ANTES XOXO" (12px, tracking 3px, cobre `#8C5A3C`), H1 Marcellus 64px "El placer es tuyo. / El secreto, nuestro.", párrafo 18px light, CTA primario "VER COLECCIÓN" + pill WhatsApp. Derecha: imagen 4:5 radius 6px.
- **Categorías**: divisor de marca (línea—texto—línea) + grid 4 tarjetas (círculo 64px arena con inicial Marcellus vino y borde oro + nombre).
- **Catálogo "Top ventas"**: grid 4 columnas gap 24px de tarjetas de producto (ver Componentes). Clic abre modal de producto (overlay `rgba(43,27,32,.5)`, tarjeta crema radius 6px, grid 2 col, shadow-pop).
- **Pilares**: banda crema con 3 columnas (H3 Marcellus 24px + párrafo light): Confianza primero / Experiencia de regalo / Para todos.
- **Asesoría/newsletter**: centrado máx 720px, formulario email + botón "RECIBIR GUÍA"; al enviar muestra badge éxito.
- **Footer**: fondo vino, wordmark en oro, slogan, links marfil.

### 2. Catálogo (`paginas/catalogo.html`)
- Breadcrumb 13.5px → título "Catálogo" (Marcellus 44px) + select "Ordenar" (relevancia/precio asc/desc).
- Grid 230px sidebar + contenido, gap 48px. Sidebar sticky (top 96px): filtros por Categoría y Marca (links toggle: activo = vino semibold + "✕"), badges de promesas.
- Grid de productos 3 columnas, contador "N productos · filtro". Filtro por URL: `?cat=Lencería` (los links del header lo usan).
- Paginación centrada: botones 1 (contorno activo) 2 3 →.

### 3. Producto (`paginas/producto.html`)
- Breadcrumb → grid 1.05fr/1fr gap 64px.
- **Galería**: imagen principal 4:5 radius 6px con badge "TOP VENTAS" (oro) + fila de 4 miniaturas cuadradas (activa con borde 2px oro).
- **Info**: kicker "BIENESTAR · SATISFYER", H1 Marcellus 44px, precio 24px vino semibold + badge "Disponible" (verde `#587A4F`), párrafo light, badges de promesa, stepper cantidad (− n +) + botón primario flex:1 "AGREGAR AL CARRITO", pill WhatsApp con mensaje precargado.
- **Acordeones** (`<details>`): "Así llega tu pedido" (ABIERTO por defecto — la discreción primero), "Especificaciones", "Cuidado y limpieza". Summary en Marcellus 18px, borde inferior 1px línea.
- **Relacionados**: divisor "TAMBIÉN TE PUEDE GUSTAR" + grid 4 tarjetas.

### 4. Checkout (`paginas/checkout.html`)
- Header simplificado (solo logo centrado). Barra anuncio cambia a: "Empaque neutro y remitente genérico — nadie sabrá qué llegó".
- **Stepper** 3 pasos (Bolsa/Datos/Pago): círculos 30px numerados, completado = fondo vino.
- Grid 1.2fr/0.8fr: panel de paso + resumen sticky (items, envío $12.000, total 24px vino, badges, pill de ayuda WhatsApp).
- **Paso 1 Bolsa**: tarjetas de item (miniatura 88×110 + nombre + cantidad + precio) + CTA continuar.
- **Paso 2 Datos**: form nombre/celular/ciudad(select con Medellín primero)/dirección/notas + caja arena con nota de discreción ("en la guía solo aparece 'artículos personales'").
- **Paso 3 Pago**: radios como tarjetas — "Contra entrega" (seleccionada: borde 2px vino, badge oro "MEDELLÍN") y "Transferencia o tarjeta" (nota: el cobro aparece como "SECRETO BTQ"). Radio accent-color `#5C1A2E`.
- **Confirmación**: círculo ✓ verde 88px, "Pedido confirmado", texto "…tu secreto está a salvo", CTA volver.

## Interactions & Behavior
- Hover botones primarios: `#5C1A2E → #71243C`; active: `#451423`. Transiciones 150–200ms ease, sin bounces.
- Hover tarjetas de producto: `translateY(-2px)` + `--shadow-card`.
- Links: vino → cobre en hover.
- Carrito: contador en header (persistir en estado real; los HTML usan un contador simple).
- Filtros del catálogo: toggle inmediato client-side; leer categoría inicial de la URL.
- Modal home: clic fuera cierra; "Ver detalle completo" navega a producto.
- Checkout: validación HTML5 en paso 2; el stepper se oculta en la confirmación.
- Formulario newsletter: preventDefault + estado de éxito.

## State Management
- `carrito: {items: [{id, qty}]}` — contador visible en header, alimenta checkout.
- Catálogo: `filtroCategoria`, `filtroMarca`, `orden` (relevancia | precio asc | desc).
- Producto: `cantidad`, `imagenActiva`.
- Checkout: `paso (1-3)`, `datosEntrega`, `metodoPago ('contraentrega' | 'online')`, `confirmado`.
- Datos de producto: catálogo real vendrá del cliente (hoy hay 9 productos de muestra hardcodeados).

## Design Tokens
Todo está en `design_system/tokens/` como custom properties CSS — usarlos como fuente de verdad:
- **Colores**: página `#F7F1E8` marfil · tarjetas `#FFFDF9` crema · suave/hover `#F1E7D8` arena · bordes `#E2D5C2` · marca/CTA `#5C1A2E` vino (hover `#71243C`, press `#451423`) · acento `#C9A96E` oro · kickers `#8C5A3C` cobre · titulares `#2B1B20` tinta · texto `#4A3A40` / `#8A7364` / `#B49C86` · éxito `#587A4F` · error `#A33D3D`.
- **Tipografía**: Marcellus (Google Fonts, solo 400) para logo/h1–h3/precios destacados/citas; Archivo (300–600) para todo lo demás. Escala: 12/13.5/15/18/24/32/44/64. Kickers: 12px uppercase tracking 3px cobre. Botones: uppercase tracking 1.5px medium.
- **Espaciado**: base 4px (4/8/12/16/24/32/48/64/96). Contenido máx 1200px.
- **Radios**: 2px botones · 4px tarjetas/inputs · 6px modales/imágenes · 999px SOLO chips y CTA WhatsApp.
- **Sombras**: `0 2px 14px rgba(43,27,32,.07)` (hover tarjetas) · `0 12px 40px rgba(43,27,32,.16)` (modales). Ninguna otra.

## Assets
- `logos/` — 22 PNG finales: 4 logos (principal, oscuro, transición "antes XOXO", con slogan), 3 avatares 1080×1080 y 15 portadas de destacados de IG. El logo es tipográfico (Marcellus + tracking); para web usar las clases `.logo-wordmark` / `.logo-sello`, no las imágenes.
- Fotos de producto: NO incluidas — placeholders 4:5. Pedir sesión de fotos sobre fondo arena `#F1E7D8`, luz cálida.
- Iconos: usar Lucide (stroke 1.5px) si se necesitan; la marca es tipográfica, sin emojis.

## Files
- `design_system/styles.css` — entry point; importa `tokens/` (colores, tipografía, espaciado, fuentes Google y `components.css` con clases de producción: `.btn-primario`, `.btn-contorno`, `.btn-whatsapp`, `.card-producto`, `.badge*`, `.input`, `.select`, `.kicker`, `.divisor`, `.logo-wordmark`, `.logo-sello`).
- `design_system/components/core/` — referencia React de las 6 primitivas (Button, WhatsAppCta, Input, Select, Badge, ProductCard) con `.d.ts` y `.prompt.md`.
- `design_system/GUIA-DE-MARCA.md` — guía completa de marca: tono de voz (crítico para el copy), reglas visuales, logo.
- `design_system/SKILL.md` — permite usar esta carpeta como Skill de Claude Code (`/skill secreto-design`).
- `paginas/index.html` · `catalogo.html` · `producto.html` · `checkout.html` — las 4 referencias de diseño (referencian `../design_system/styles.css`; abrir desde la estructura del paquete).
