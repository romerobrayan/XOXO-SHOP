// DistriSex (WooCommerce Store API) → staging.
//
// The Store API hands us the option-vs-spec distinction for free:
// `attributes[].has_variations: true` is an axis the customer chooses
// (ProductOption), `false` is display-only (ProductSpec) — exactly the
// CLAUDE.md rule. The "Marca" attribute is the brand.
import {
  canonicalizeBrand,
  detectBrand,
  hexForColor,
  parseSuggestedRetailCents,
  stripHtml,
  suggestCategory,
  wooPriceToCents,
} from "../../../src/features/import/normalize";
import type { StagedProduct, StagedVariant } from "./staging";

export type WooTerm = { id: number; name: string; slug: string };

export type WooAttribute = {
  id: number;
  name: string;
  taxonomy: string | null;
  has_variations: boolean;
  terms: WooTerm[];
};

export type WooProduct = {
  id: number;
  name: string;
  slug: string;
  type: string; // "simple" | "variable" | ...
  permalink: string;
  sku: string;
  short_description: string;
  description: string;
  prices: {
    price: string;
    regular_price: string;
    sale_price: string;
    price_range: { min_amount: string; max_amount: string } | null;
    currency_minor_unit: number;
  };
  images: { id: number; src: string; alt: string }[];
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  attributes: WooAttribute[];
  variations: { id: number; attributes: { name: string; value: string }[] }[];
  has_options: boolean;
  is_purchasable: boolean;
  is_in_stock: boolean;
};

export function normalizeDistrisex(
  p: WooProduct,
  warn: (msg: string) => void,
): StagedProduct {
  const minorUnit = p.prices.currency_minor_unit;
  const priceCents = wooPriceToCents(p.prices.price, minorUnit);
  const regularCents = wooPriceToCents(p.prices.regular_price, minorUnit);

  const optionAttrs = p.attributes.filter(
    (a) => a.has_variations && a.terms.length > 0,
  );
  const specAttrs = p.attributes.filter(
    (a) => !a.has_variations && !/^marca$/i.test(a.name) && a.terms.length > 0,
  );

  const marcaAttr = p.attributes.find((a) => /^marca$/i.test(a.name));
  const brand = marcaAttr?.terms[0]
    ? canonicalizeBrand(marcaAttr.terms[0].name)
    : detectBrand(p.categories.map((c) => c.name));

  const categoryNames = p.categories.map((c) => c.name);

  let variants: StagedVariant[];
  if (p.type === "variable" && p.variations.length > 0) {
    variants = p.variations.map((v) => ({
      supplierVariantId: String(v.id),
      // Woo's product list omits variation SKUs and prices; promote.ts
      // fetches each approved variation individually to fill them in.
      sku: null,
      options: Object.fromEntries(
        v.attributes
          .filter((a) => a.value !== "")
          .map((a) => [a.name, a.value]),
      ),
      supplierPriceCents: priceCents,
      supplierCompareAtCents: regularCents > priceCents ? regularCents : null,
      available: p.is_in_stock,
    }));
  } else {
    if (p.type === "variable") {
      warn(
        `distrisex:${p.id} "${p.name}" is variable but lists no variations — staged as a single variant`,
      );
    }
    variants = [
      {
        supplierVariantId: String(p.id),
        sku: p.sku?.trim() || null,
        options: {},
        supplierPriceCents: priceCents,
        supplierCompareAtCents: regularCents > priceCents ? regularCents : null,
        available: p.is_in_stock,
      },
    ];
  }

  const seenImage = new Set<string>();
  const images = p.images
    .filter((img) => {
      const key = img.src.split("?")[0];
      if (seenImage.has(key)) return false;
      seenImage.add(key);
      return true;
    })
    .map((img, position) => ({ url: img.src, optionValue: null, position }));

  if (images.length === 0) warn(`distrisex:${p.id} "${p.name}" has no images`);

  return {
    supplierRef: `distrisex:${p.id}`,
    supplier: "distrisex",
    supplierUrl: p.permalink,
    name: stripHtml(p.name),
    descriptionText: stripHtml(p.description || p.short_description || ""),
    brand,
    supplierCategories: categoryNames,
    tags: p.tags.map((t) => t.name),
    suggestedCategorySlug: suggestCategory([...categoryNames, p.name]),
    supplierPriceCents: priceCents,
    suggestedRetailCents: parseSuggestedRetailCents(p.short_description ?? ""),
    priceVariesByVariant: p.prices.price_range !== null,
    options: optionAttrs.map((a) => ({
      name: a.name,
      values: a.terms.map((t) => ({
        value: t.name,
        hex: hexForColor(a.name, t.name),
      })),
    })),
    specs: specAttrs.map((a) => ({
      label: a.name,
      value: a.terms.map((t) => t.name).join(", ").slice(0, 500),
    })),
    images,
    variants,
  };
}
