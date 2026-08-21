import { z } from "zod";

import { DEPARTAMENTOS } from "@/features/checkout/schemas";
import { pesosToCents } from "@/lib/pesos";
import { normalizeArea } from "./zones";

// A delivery fee is not a product price: free shipping is a real offer, so
// the floor is 0, and the ceiling is generous enough for a remote-department
// courier without letting a typo bill someone a million pesos.
export const SHIPPING_MIN_CENTS = 0;
export const SHIPPING_MAX_CENTS = 500_000_00; // COP 500.000

export const MAX_AREAS_PER_ZONE = 120;

export const SHIPPING_ZONE_KINDS = ["SPECIFIC", "GENERAL", "NATIONAL"] as const;

export type ShippingZoneKindInput = (typeof SHIPPING_ZONE_KINDS)[number];

/**
 * The client types covered locations as free text — one per line or separated
 * by commas, the way they would write them to an advisor. This is where that
 * turns into rows: trimmed, de-duplicated by normalized key (so "El Poblado"
 * and "poblado" cannot both land), capped, and paired with the label as
 * written so the panel shows it back in their own words.
 */
export const areasFromText = z
  .string()
  .max(4000, "La lista de ubicaciones es demasiado larga")
  .transform((raw) => {
    const seen = new Map<string, string>();
    for (const chunk of raw.split(/[\n,;]+/)) {
      const label = chunk.trim().replace(/\s+/g, " ");
      if (label.length === 0) continue;
      const matchKey = normalizeArea(label);
      if (matchKey.length === 0 || seen.has(matchKey)) continue;
      seen.set(matchKey, label);
    }
    return [...seen].map(([matchKey, label]) => ({ label, matchKey }));
  })
  .refine(
    (areas) => areas.length <= MAX_AREAS_PER_ZONE,
    `No más de ${MAX_AREAS_PER_ZONE} ubicaciones por zona`,
  );

const zoneFields = {
  name: z
    .string()
    .trim()
    .min(2, "Ponle un nombre a la zona")
    .max(60, "El nombre no puede tener más de 60 caracteres"),
  kind: z.enum(SHIPPING_ZONE_KINDS, { message: "Elige el tipo de zona" }),
  // Validated against the real list, not free text: the checkout matches on
  // it, and a department spelled differently here would never match.
  department: z.enum(DEPARTAMENTOS).optional(),
  priceCents: pesosToCents({
    min: SHIPPING_MIN_CENTS,
    max: SHIPPING_MAX_CENTS,
    minMessage: "El domicilio no puede ser negativo",
    maxMessage: "El domicilio no puede ser mayor a $500.000",
  }),
  note: z
    .string()
    .trim()
    .max(120, "La nota es demasiado larga")
    .optional()
    .transform((value) => (value === "" ? undefined : value)),
  areas: areasFromText,
  isActive: z.boolean(),
};

// The shape rules, in one place: a specific zone is meaningless without the
// locations it covers, and the national zone is by definition the one without
// a department.
function refineZoneShape(
  value: {
    kind: ShippingZoneKindInput;
    department?: string;
    areas: { label: string; matchKey: string }[];
  },
  ctx: z.RefinementCtx,
) {
  if (value.kind === "NATIONAL") {
    if (value.department) {
      ctx.addIssue({
        code: "custom",
        path: ["department"],
        message: "El domicilio nacional cubre todo el país, sin departamento",
      });
    }
  } else if (!value.department) {
    ctx.addIssue({
      code: "custom",
      path: ["department"],
      message: "Elige el departamento de la zona",
    });
  }

  if (value.kind === "SPECIFIC" && value.areas.length === 0) {
    ctx.addIssue({
      code: "custom",
      path: ["areas"],
      message: "Escribe al menos una ubicación, ej. El Poblado, Laureles",
    });
  }
  if (value.kind !== "SPECIFIC" && value.areas.length > 0) {
    ctx.addIssue({
      code: "custom",
      path: ["areas"],
      message:
        "Esta zona cubre todo lo que no calce en otra: no lleva ubicaciones",
    });
  }
}

export const createShippingZoneSchema = z
  .object({ ...zoneFields })
  .superRefine(refineZoneShape);

export const updateShippingZoneSchema = z
  .object({ zoneId: z.string().min(1), ...zoneFields })
  .superRefine(refineZoneShape);

export const deleteShippingZoneSchema = z.object({
  zoneId: z.string().min(1),
});

export const setShippingZoneActiveSchema = z.object({
  zoneId: z.string().min(1),
  isActive: z.boolean(),
});
