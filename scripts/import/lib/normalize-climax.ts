// Climax (Shopify /products.json) → staging.
//
// Shopify's model is close to ours: options + variants, real per-variant
// prices and SKUs. The gaps are taxonomy (`product_type` is the only category
// signal) and brand (`vendor` is mostly the Shopify default "My Store", so the
// brand hides in titles and tags).
import type { StagedImage, StagedProduct } from "./staging";
import {
  canonicalizeBrand,
  detectBrand,
  hexForColor,
  shopifyPriceToCents,
  stripHtml,
  suggestCategory,
} from "./normalize";

export type ShopifyVariant = {
  id: number;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string | null;
  available: boolean;
  price: string;
  compare_at_price: string | null;
  position: number;
};

export type ShopifyImage = {
  id: number;
  position: number;
  src: string;
  variant_ids: number[];
};

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ShopifyVariant[];
  images: ShopifyImage[];
  options: { name: string; position: number; values: string[] }[];
};

const SHOPIFY_DEFAULT_VENDORS = /^(my store|vendor-name|default)$/i;

export function normalizeClimax(
  p: ShopifyProduct,
  warn: (msg: string) => void,
): StagedProduct {
  const orderedOptions = [...p.options].sort((a, b) => a.position - b.position);
  const realOptions = orderedOptions.filter((o) => o.name !== "Title");

  const variantOptionEntries = (v: ShopifyVariant): [string, string][] => {
    const raw = [v.option1, v.option2, v.option3];
    return orderedOptions
      .map((o, i) => [o.name, raw[i]] as const)
      .filter(
        (pair): pair is [string, string] =>
          pair[0] !== "Title" && pair[1] !== null && pair[1] !== "",
      );
  };

  const variants = p.variants.map((v) => {
    const priceCents = shopifyPriceToCents(v.price);
    const compareCents = v.compare_at_price
      ? shopifyPriceToCents(v.compare_at_price)
      : null;
    return {
      supplierVariantId: String(v.id),
      sku: v.sku?.trim() || null,
      options: Object.fromEntries(variantOptionEntries(v)),
      supplierPriceCents: priceCents,
      supplierCompareAtCents:
        compareCents !== null && compareCents > priceCents ? compareCents : null,
      available: v.available,
    };
  });

  if (variants.length === 0) {
    // Shopify always publishes at least the default variant; reaching this
    // means the payload shape changed — surface it instead of guessing.
    throw new Error(`climax:${p.handle} arrived with zero variants`);
  }

  // Brand: known brand in title/tags first; a non-default vendor second
  // ("Climax" is plausibly their house lingerie line); curation can override.
  const brand =
    detectBrand([p.title, ...p.tags]) ??
    (p.vendor && !SHOPIFY_DEFAULT_VENDORS.test(p.vendor)
      ? canonicalizeBrand(p.vendor)
      : null);

  // Variant-specific images: when Shopify pins an image to variants that share
  // a color value, surface it as that color's photo (ProductMedia.optionValueId).
  const colorOption = realOptions.find((o) => /color/i.test(o.name));
  const variantById = new Map(p.variants.map((v) => [v.id, v]));
  const images: StagedImage[] = [...p.images]
    .sort((a, b) => a.position - b.position)
    .map((img, position) => {
      let optionValue: StagedImage["optionValue"] = null;
      if (colorOption && img.variant_ids.length > 0) {
        const v = variantById.get(img.variant_ids[0]);
        if (v) {
          const value = variantOptionEntries(v).find(
            ([name]) => name === colorOption.name,
          )?.[1];
          if (value) optionValue = { option: colorOption.name, value };
        }
      }
      return { url: img.src, optionValue, position };
    });

  if (images.length === 0) warn(`climax:${p.handle} "${p.title}" has no images`);

  const categoryCandidates = [p.product_type, ...p.tags, p.title];

  return {
    supplierRef: `climax:${p.handle}`,
    supplier: "climax",
    supplierUrl: `https://climax.com.co/products/${p.handle}`,
    name: p.title.trim(),
    descriptionText: stripHtml(p.body_html ?? ""),
    brand,
    supplierCategories: p.product_type ? [p.product_type] : [],
    tags: p.tags,
    suggestedCategorySlug: suggestCategory(categoryCandidates),
    supplierPriceCents: Math.min(...variants.map((v) => v.supplierPriceCents)),
    suggestedRetailCents: null,
    priceVariesByVariant: false, // Shopify variant prices are already real
    options: realOptions.map((o) => ({
      name: o.name,
      values: o.values.map((value) => ({
        value,
        hex: hexForColor(o.name, value),
      })),
    })),
    specs: [], // Shopify exposes no structured attributes on this endpoint
    images,
    variants,
  };
}
