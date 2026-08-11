// Single source for the legal pages: who the pages link to, when they were
// last revised, and the identity of the data controller. The footer, the
// legal nav and the pages themselves all read from here so a renamed route
// or a corrected identity never has to be chased across files.
//
// ─────────────────────────────────────────────────────────────────────────
// PENDIENTE ANTES DE RADICAR LA PASARELA — completar `RESPONSABLE`.
// La Ley 1581 de 2012 (art. 13 del Decreto 1377 de 2013) exige que la
// política identifique al responsable del tratamiento con su identificación
// y un canal de atención. Hoy la política se sostiene sobre el nombre
// comercial, la ciudad y el WhatsApp real del negocio — todo cierto, pero
// incompleto. Falta la razón social o el nombre de la persona natural, el
// NIT o cédula, y el domicilio. Cuando la clienta los entregue van aquí y
// las cuatro páginas los recogen solas.
// ─────────────────────────────────────────────────────────────────────────

export const RESPONSABLE = {
  /** Nombre comercial. Este sí es definitivo. */
  nombreComercial: "SECRETO · antes XOXO",
  /** Razón social o nombre de la persona natural que registra el comercio. */
  razonSocial: "",
  /** NIT o cédula de quien registra. */
  identificacion: "",
  /** Domicilio para notificaciones. */
  domicilio: "",
  /** Ciudad de operación — confirmada. */
  ciudad: "Medellín, Colombia",
  /**
   * Correo de atención. Hoy no existe correo comercial (deuda abierta en
   * docs/ESTADO-Y-SIGUIENTE-SESION.md); mientras tanto el canal de habeas
   * data es el WhatsApp de src/lib/contact.ts, que sí está operando.
   */
  correo: "",
} as const;

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

export type Responsable = {
  nombreComercial: string;
  razonSocial: string;
  identificacion: string;
  domicilio: string;
  ciudad: string;
  correo: string;
};

/**
 * Cómo se identifica el responsable en el cuerpo de las páginas. Devuelve
 * una frase completa con los datos que existan hoy — nunca un hueco visible
 * en una página publicada. Recibe el responsable por parámetro para que la
 * prueba pueda ejercitar el estado completo sin esperar a la clienta.
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
