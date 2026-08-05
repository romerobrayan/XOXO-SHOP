import { z } from "zod";

// Zod schemas are the single source of truth for checkout input types.
//
// The cart in localStorage is untrusted input: the server accepts only
// { variantId, qty } per line and re-reads price, name, SKU and option
// labels from the database at order creation. Any price a client sends
// is stripped here, at the boundary, before the action ever sees it.

// Retail bounds, not business rules — they exist so a malformed or
// hostile payload cannot ask the reservation logic for absurd numbers.
export const MAX_ORDER_LINES = 30;
export const MAX_QTY_PER_LINE = 20;

// 32 departments + Bogotá D.C. — `department` is required for Colombian
// invoicing (see Address in prisma/schema.prisma). Exported for the
// checkout form's Select.
export const DEPARTAMENTOS = [
  "Amazonas",
  "Antioquia",
  "Arauca",
  "Atlántico",
  "Bogotá D.C.",
  "Bolívar",
  "Boyacá",
  "Caldas",
  "Caquetá",
  "Casanare",
  "Cauca",
  "Cesar",
  "Chocó",
  "Córdoba",
  "Cundinamarca",
  "Guainía",
  "Guaviare",
  "Huila",
  "La Guajira",
  "Magdalena",
  "Meta",
  "Nariño",
  "Norte de Santander",
  "Putumayo",
  "Quindío",
  "Risaralda",
  "San Andrés y Providencia",
  "Santander",
  "Sucre",
  "Tolima",
  "Valle del Cauca",
  "Vaupés",
  "Vichada",
] as const;

// Mirrors enum DocumentType in prisma/schema.prisma.
export const DOCUMENT_TYPES = ["CC", "CE", "NIT", "PP"] as const;

export const checkoutItemSchema = z.object({
  variantId: z.string().trim().min(1).max(64),
  qty: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1")
    .max(MAX_QTY_PER_LINE, `Máximo ${MAX_QTY_PER_LINE} unidades por producto`),
  // The price the customer SAW, never the price they pay — the action prices
  // from the database and uses this only to detect a stale bag, so nobody is
  // silently charged something other than what was on screen.
  expectedPriceCents: z.number().int().positive().optional(),
});

// Colombian mobile: 10 digits starting with 3. Accepts the formats people
// actually type — spaces, dashes, a +57 or 57 prefix — and normalizes to
// bare digits before validating.
const celularSchema = z
  .string()
  .transform((value) => value.replace(/[\s\-().]/g, "").replace(/^\+?57(?=3)/, ""))
  .refine((value) => /^3\d{9}$/.test(value), {
    message: "Escribe un celular colombiano válido, ej. 300 000 0000",
  });

export const deliveryDataSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "Escribe tu nombre completo")
    .max(120, "El nombre es demasiado largo"),
  celular: celularSchema,
  // Optional at the schema level; createOrderSchema requires it for online
  // payment (the gateway needs it). Contra entrega stays WhatsApp-only —
  // guest checkout never asks for more data than the flow needs.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Escribe un correo válido"))
    .optional(),
  documentType: z.enum(DOCUMENT_TYPES, {
    message: "Elige un tipo de documento",
  }),
  documentId: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,20}$/, "Escribe un número de documento válido"),
  department: z.enum(DEPARTAMENTOS, { message: "Elige tu departamento" }),
  ciudad: z
    .string()
    .trim()
    .min(2, "Escribe tu ciudad")
    .max(80, "El nombre de la ciudad es demasiado largo"),
  direccion: z
    .string()
    .trim()
    .min(5, "Escribe una dirección completa")
    .max(200, "La dirección es demasiado larga"),
  barrio: z.string().trim().max(80).optional(),
  notas: z
    .string()
    .trim()
    .max(200, "Las notas son demasiado largas")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
});

// What the customer chooses at step 3. "ONLINE" is deliberately not a
// PaymentMethod enum value: the gateway's checkout decides the actual rail
// (CARD / PSE / NEQUI…) and the webhook records it — see spec §2.
export const CHECKOUT_PAYMENT_METHODS = ["CASH_ON_DELIVERY", "ONLINE"] as const;

export const createOrderSchema = z
  .object({
    // Generated once per checkout attempt (crypto.randomUUID()); unique on
    // Order so a double-tap or a retried request creates one order, not two.
    idempotencyKey: z.uuid(),
    items: z
      .array(checkoutItemSchema)
      .min(1, "Tu bolsa está vacía")
      .max(MAX_ORDER_LINES, "Demasiados productos distintos en un pedido")
      .refine(
        (items) => new Set(items.map((i) => i.variantId)).size === items.length,
        { message: "Hay productos repetidos en la bolsa" },
      ),
    delivery: deliveryDataSchema,
    paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS),
  })
  .superRefine((value, ctx) => {
    if (value.paymentMethod === "ONLINE" && !value.delivery.email) {
      ctx.addIssue({
        code: "custom",
        path: ["delivery", "email"],
        message: "Para pagar en línea necesitamos tu correo",
      });
    }
  });

export type CheckoutItemInput = z.infer<typeof checkoutItemSchema>;
export type DeliveryData = z.infer<typeof deliveryDataSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];
