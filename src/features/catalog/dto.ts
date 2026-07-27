// Server-side view models. This is the boundary that keeps Prisma rows — and
// with them stockOnHand/stockReserved — out of page props and client bundles.
// Everything the storefront renders comes through these mappers.
import {
  availableOf,
  bandFor,
  DEFAULT_LOW_STOCK_AT,
  type AvailabilityBand,
} from "./availability";
import {
  sortVariants,
  type PickerOption,
  type PickerVariant,
} from "./pickerState";
import type { ProductCardPayload, ProductDetailPayload } from "./shapes";

export type MediaDTO = {
  id: string;
  type: "IMAGE" | "VIDEO";
  url: string;
  posterUrl: string | null;
  alt: string;
  optionValueId: string | null;
};

export type ProductCardDTO = {
  id: string;
  slug: string;
  name: string;
  // Shown in the home product modal; cards themselves don't render it.
  description: string | null;
  brandName: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  priceFromCents: number;
  priceVaries: boolean;
  compareAtCents: number | null;
  discountPercent: number | null;
  hasOptions: boolean;
  availability: AvailabilityBand;
  // Set only for option-less products with stock — powers the direct
  // "Agregar al carrito" card CTA. Products with options route to the PDP.
  addToCartVariantId: string | null;
};

export type ProductDetailDTO = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  supplierRef: string | null;
  brandName: string | null;
  brandSlug: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  options: PickerOption[];
  variants: PickerVariant[];
  specs: { label: string; value: string }[];
  media: MediaDTO[];
};

export type BrandSummary = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export type CategorySummary = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

export function toProductCard(p: ProductCardPayload): ProductCardDTO {
  const totalAvailable = p.variants.reduce((sum, v) => sum + availableOf(v), 0);
  const prices = p.variants.map((v) => v.priceCents);
  const priceFromCents = prices.length ? Math.min(...prices) : p.minPriceCents;
  const priceVaries = prices.length ? Math.max(...prices) !== priceFromCents : false;

  // The promo treatment on a card follows the variant whose price the card
  // shows (the cheapest one).
  const shownVariant = p.variants.find((v) => v.priceCents === priceFromCents);
  const compareAtCents =
    shownVariant?.compareAtCents && shownVariant.compareAtCents > priceFromCents
      ? shownVariant.compareAtCents
      : null;
  const discountPercent = compareAtCents
    ? Math.round((1 - priceFromCents / compareAtCents) * 100)
    : null;

  const hasOptions = p.options.length > 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    brandName: p.brand?.name ?? null,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
    priceFromCents,
    priceVaries,
    compareAtCents,
    discountPercent,
    hasOptions,
    availability: bandFor(totalAvailable, DEFAULT_LOW_STOCK_AT),
    addToCartVariantId:
      !hasOptions && totalAvailable > 0 && p.variants[0]
        ? p.variants[0].id
        : null,
  };
}

export function toProductDetail(p: ProductDetailPayload): ProductDetailDTO {
  const options: PickerOption[] = p.options.map((o) => ({
    id: o.id,
    name: o.name,
    values: o.values.map((v) => ({ id: v.id, value: v.value, hex: v.hex })),
  }));
  const variants: PickerVariant[] = sortVariants(
    options,
    p.variants.map((v) => ({
      id: v.id,
      priceCents: v.priceCents,
      compareAtCents: v.compareAtCents,
      available: availableOf(v),
      lowStockAt: v.lowStockAt,
      optionValueIds: v.optionValues.map((ov) => ov.optionValueId),
    })),
  );
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    supplierRef: p.supplierRef,
    brandName: p.brand?.name ?? null,
    brandSlug: p.brand?.slug ?? null,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
    options,
    variants,
    specs: p.specs.map((s) => ({ label: s.label, value: s.value })),
    media: p.media.map((m) => ({
      id: m.id,
      type: m.type,
      url: m.url,
      posterUrl: m.posterUrl,
      alt: m.alt,
      optionValueId: m.optionValueId,
    })),
  };
}
