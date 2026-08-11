// Single source for the legal pages: who the pages link to, when they were
// last revised, and the identity of the data controller. The footer, the
// legal nav and the pages themselves all read from here so a renamed route
// or a corrected identity never has to be chased across files.
//
// ─────────────────────────────────────────────────────────────────────────
// LOS DATOS DEL RESPONSABLE VIENEN DEL ENTORNO, NO DEL REPOSITORIO.
//
// Este repositorio es público. El nombre y el NIT de una persona natural
// puestos en un commit quedan en el historial de git para siempre: los forks,
// la caché y la API de GitHub hacen que borrarlos después no sirva de nada.
// La página publicada sí los muestra —el art. 13 del Decreto 1377 de 2013 y
// el art. 50 de la Ley 1480 de 2011 los exigen— pero salen de variables de
// entorno cargadas en Vercel, así que corregirlos es editar una variable y no
// dejan rastro acá.
//
// Se cargan en Vercel (Production y Preview) y en el `.env` local:
//   LEGAL_RAZON_SOCIAL   nombre de la persona natural o razón social
//   LEGAL_NIT            NIT con dígito de verificación
//   LEGAL_CORREO         correo de atención de habeas data
//   LEGAL_DOMICILIO      dirección de notificación — hoy vacío a propósito
//
// `LEGAL_DOMICILIO` queda deliberadamente sin valor: la tienda es virtual y
// la única dirección existente es la vivienda del titular. Publicarla en el
// sitio de una tienda de esta categoría es una exposición real, así que la
// identificación se sostiene sobre ciudad + canales de atención, y la
// dirección completa vive en el RUT y en el registro de la pasarela. Si más
// adelante hay una dirección de notificación aparte, se llena la variable y
// las cuatro páginas la recogen solas.
//
// Si faltan, las páginas no muestran un hueco: `responsableLinea()` degrada a
// nombre comercial + ciudad. Eso hace que un despliegue sin las variables se
// vea bien y esté incompleto, así que verificarlas es parte de desplegar.
// ─────────────────────────────────────────────────────────────────────────

export type Responsable = {
  nombreComercial: string;
  razonSocial: string;
  identificacion: string;
  domicilio: string;
  ciudad: string;
  correo: string;
};

export const RESPONSABLE: Responsable = {
  /** Nombre comercial. Público por definición, así que vive en el repo. */
  nombreComercial: "SECRETO · antes XOXO",
  razonSocial: process.env.LEGAL_RAZON_SOCIAL ?? "",
  identificacion: process.env.LEGAL_NIT ?? "",
  domicilio: process.env.LEGAL_DOMICILIO ?? "",
  /** Ciudad de operación — confirmada y no es dato personal. */
  ciudad: "Medellín, Antioquia, Colombia",
  correo: process.env.LEGAL_CORREO ?? "",
};

/** Fecha de la última revisión del contenido legal. Actualizar al editarlo. */
export const LEGAL_UPDATED = "11 de agosto de 2026";

/**
 * Las cuatro páginas legales, en el orden en que se listan.
 * `href` es la ruta real; `footerLabel` es la etiqueta corta del footer.
 */
export const LEGAL_PAGES = [
  {
    slug: "privacidad",
    href: "/legal/privacidad",
    title: "Tratamiento de datos personales",
    footerLabel: "Privacidad",
    description:
      "Qué datos guardamos, para qué, y cómo pides que los corrijamos o los borremos.",
  },
  {
    slug: "terminos",
    href: "/legal/terminos",
    title: "Términos y condiciones",
    footerLabel: "Términos",
    description:
      "Las reglas de la compra: quién opera la tienda, precios, pagos y responsabilidades.",
  },
  {
    slug: "envios",
    href: "/legal/envios",
    title: "Envíos y empaque discreto",
    footerLabel: "Envíos",
    description:
      "Cobertura, costo, tiempos y exactamente cómo llega la caja a tu puerta.",
  },
  {
    slug: "devoluciones",
    href: "/legal/devoluciones",
    title: "Devoluciones, garantía y retracto",
    footerLabel: "Devoluciones",
    description:
      "Qué cubre la garantía legal y por qué el retracto no aplica igual en productos íntimos.",
  },
] as const;

export type LegalSlug = (typeof LEGAL_PAGES)[number]["slug"];

export function legalPage(slug: LegalSlug) {
  const page = LEGAL_PAGES.find((p) => p.slug === slug);
  if (!page) throw new Error(`Unknown legal page: ${slug}`);
  return page;
}

/**
 * Cómo se identifica el responsable en el cuerpo de las páginas. Devuelve
 * una frase completa con los datos que existan hoy — nunca un hueco visible
 * en una página publicada. Recibe el responsable por parámetro para que la
 * prueba pueda ejercitar cualquier combinación sin depender del entorno.
 */
export function responsableLinea(
  responsable: Responsable = RESPONSABLE,
): string {
  const { nombreComercial, razonSocial, identificacion, domicilio, ciudad } =
    responsable;

  const identidad = [razonSocial, identificacion]
    .filter(Boolean)
    .join(", NIT ");
  const lugar = [domicilio, ciudad].filter(Boolean).join(", ");

  return identidad
    ? `${nombreComercial} (${identidad}), con domicilio en ${lugar}`
    : `${nombreComercial}, comercio con domicilio en ${lugar}`;
}
