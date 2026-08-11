// The client's real sales channel. One place for the number so the CTA,
// footer, PDP, and checkout never drift apart.
export const WHATSAPP_PHONE = "573168667068";

/**
 * El mismo número escrito para leerse. Las páginas legales lo muestran como
 * canal de atención, así que tiene que verse como un teléfono colombiano y no
 * como una cadena de doce dígitos.
 */
export const WHATSAPP_DISPLAY = "+57 316 866 7068";

export const INSTAGRAM_URL = "https://www.instagram.com/xoxo.sex0";

export function whatsappHref(message: string): string {
  return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(message)}`;
}
