import { customAlphabet } from "nanoid";

// Short, human-readable code the customer quotes on WhatsApp. Uppercase,
// no ambiguous glyphs (0/O, 1/I/L), SECRETO- prefix — the brand the client
// reads aloud, per the schema comment on Order.orderNumber. Six symbols over
// a 31-char alphabet ≈ 887M combinations; the unique constraint plus one
// retry in the action covers the birthday-paradox tail.
const code = customAlphabet("23456789ABCDEFGHJKMNPQRSTUVWXYZ", 6);

export function generateOrderNumber(): string {
  return `SECRETO-${code()}`;
}
