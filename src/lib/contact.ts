// The client's real sales channel. One place for the number so the CTA,
// footer, PDP, and checkout never drift apart.
export const WHATSAPP_PHONE = "573168667068";

export const INSTAGRAM_URL = "https://www.instagram.com/xoxo.sex0";

export function whatsappHref(message: string): string {
  return `https://api.whatsapp.com/send?phone=${WHATSAPP_PHONE}&text=${encodeURIComponent(message)}`;
}
