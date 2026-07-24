# SECRETO · Boutique Erótica — Design System

Sistema de diseño para el rebrand de **XOXO Sex Shop → SECRETO** (dirección B elegida por el cliente).
Tienda de productos para adultos con venta por Instagram y WhatsApp, envíos en Colombia y contra entrega en Medellín. Este sistema alimenta la web e-commerce en desarrollo y las piezas de Instagram/WhatsApp.

**Slogan:** El placer es tuyo. El secreto, nuestro.
**Propósito:** hacer del placer una experiencia de confianza — cada compra se siente como un regalo bien elegido, no como un trámite que esconder.
**Pilares:** Confianza primero · Experiencia de regalo · Para todos.
**Transición:** durante 2–3 meses se firma "SECRETO · antes XOXO" (o "by XOXO") para no perder los 29.4K seguidores.

Fuentes del proyecto: captura del perfil de Instagram original (`uploads/`), propuestas en `Propuestas de Marca.dc.html` y deck `Propuestas Deck.dc.html`.

## Índice
- `styles.css` — punto de entrada (importa todos los tokens). Enlaza este archivo en tu web.
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `fonts.css` y `components.css` (clases de producción: `.btn-primario`, `.card-producto`, `.badge`, `.input`, `.kicker`, `.divisor`, `.logo-wordmark`, `.logo-sello`).
- `components/core/` — primitivas React: **Button, WhatsAppCta, Input, Select, Badge, ProductCard** (cada una con `.d.ts` y `.prompt.md`).
- `guidelines/` — specimen cards de colores, tipografía, espaciado y marca.
- `ui_kits/web/index.html` — home e-commerce interactiva (héroe, categorías, catálogo, modal de producto, carrito, footer).

## Fundamentos de contenido
- **Idioma:** español (Colombia), trato de "tú".
- **Tono:** cálido y seguro, como un buen sommelier: recomienda sin juzgar. Directo pero elegante — todo se nombra con naturalidad ("succionador de clítoris"), nunca con vulgaridad ni eufemismos infantiles.
- **Sin emojis.** La discreción y la calidad se dicen en texto plano. Flechas `→` y `↓` son los únicos ornamentos.
- **Ejemplos:**
  - ✕ "Aprovecha ya este juguetazo 🍆💦"
  - ✓ "¿Primera vez? Empieza por Musa: suave, silencioso, y nadie sabrá qué llegó en la caja."
- La promesa de discreción aparece en cada punto de contacto: "Envío discreto" junto al precio, badges "EMPAQUE NEUTRO", barra de anuncio "Envíos discretos en toda Colombia".
- Precios en formato colombiano: `$120.000`.

## Fundamentos visuales
- **Paleta:** marfil `#F7F1E8` (página), crema `#FFFDF9` (tarjetas), arena `#F1E7D8` (suave/hover), línea `#E2D5C2` (bordes), vino `#5C1A2E` (marca/CTA), oro viejo `#C9A96E` (acento), cobre `#8C5A3C` (kickers), tinta `#2B1B20` (titulares). Vibe: perfumería premium, no sex shop de neón. Máx. 2 fondos por vista (marfil + crema).
- **Tipografía:** Marcellus (display: logo, h1–h3, precios destacados, citas; solo peso 400) + Archivo (interfaz/cuerpo, 300–600). Kickers: Archivo 12px, uppercase, tracking 3px, cobre. Botones: uppercase, tracking 1.5px.
- **Espaciado:** base 4px (`--sp-1`…`--sp-9`). Contenido máx. 1200px.
- **Radios:** casi rectos — 2px botones, 4px tarjetas/inputs, 6px modales. Pills (999px) SOLO en chips/badges y el CTA de WhatsApp.
- **Sombras:** una sola sombra cálida `--shadow-card` (hover de tarjetas) y `--shadow-pop` (modales). Nada de sombras duras ni de colores.
- **Fondos:** planos o degradado sutil crema→arena en héroes. Sin patrones ni texturas.
- **Hover:** botones aclaran el vino (`--vino-claro`); tarjetas elevan (`translateY(-2px)` + sombra); enlaces vino→cobre. Press: `--vino-profundo`. Transiciones 150–200ms ease; sin bounces.
- **Imágenes:** fotos de producto en proporción 4:5 sobre fondo arena, luz cálida y limpia. Mientras no haya fotos reales: placeholder de rayas diagonales arena con etiqueta monospace — nunca dibujar productos en SVG.
- **Motivo de marca:** el "divisor" — línea fina a cada lado de un texto centrado (`.divisor`).
- **Bordes:** 1px `--linea` en todo; 1.5px solo en el sello del logo.

## Iconografía
- Casi sin iconos: la marca se apoya en tipografía. Donde se necesiten (bolsa, búsqueda, flechas), usar **Lucide** vía CDN (`https://unpkg.com/lucide@latest`), stroke 1.5px, color `--texto-cuerpo` o `--vino`. Sin emojis, sin iconos rellenos.
- Iniciales en círculo (estilo sello) para categorías y highlights de Instagram: letra Marcellus sobre arena con borde oro.

## Logo
El logo es **tipográfico**: wordmark "Secreto" en Marcellus uppercase con tracking 0.25em (`.logo-wordmark`) y sello circular "S" (`.logo-sello`). Versiones: vino/crema (principal), oro/vino (oscura), tinta/arena (secundaria). Sello mínimo 44px. **Pendiente:** vectorización final por el diseñador para archivos de imprenta.

## Adiciones intencionales
- `WhatsAppCta` — el canal de venta real del negocio; único CTA con forma pill.
- `tokens/components.css` — clases CSS de producción espejo de los componentes React, para usar directo en la web sin React.
