import { z } from "zod";

// Cents come from a text input as pesos ("120.000" or "120000"), so the
// schema owns the conversion: strip separators, multiply once, integers only
// after that. Money never travels as a float (CLAUDE.md rule 1).
//
// Bounds differ per field — a product price and a delivery fee are not the
// same kind of number — so the parser is a factory and each feature declares
// its own limits next to the reason for them.
export function pesosToCents({
  min,
  max,
  minMessage,
  maxMessage,
}: {
  min: number;
  max: number;
  minMessage: string;
  maxMessage: string;
}) {
  return z
    .string()
    .trim()
    .regex(/^\$?\s*\d{1,3}(\.\d{3})*$|^\$?\s*\d+$/, "Precio inválido")
    .transform((raw) => Number(raw.replace(/[^\d]/g, "")) * 100)
    .refine((cents) => cents >= min, minMessage)
    .refine((cents) => cents <= max, maxMessage);
}
