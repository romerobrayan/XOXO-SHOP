import { describe, expect, it } from "vitest";
import type { CategorySummary, ProductCardDTO } from "@/features/catalog/dto";
import { heroSlides } from "./heroSlides";

const categories: CategorySummary[] = [
  { id: "cat-lenceria", name: "Lencería", slug: "lenceria", productCount: 2 },
  {
    id: "cat-cosmetica",
    name: "Cosmética íntima",
    slug: "cosmetica-intima",
    productCount: 1,
  },
];

function product(overrides: Partial<ProductCardDTO>): ProductCardDTO {
  return {
    id: "p1",
    slug: "producto",
    name: "Producto",
    description: null,
    brandName: null,
    categoryName: "Lencería",
    categorySlug: "lenceria",
    priceFromCents: 45_000_00,
    priceVaries: false,
    compareAtCents: null,
    discountPercent: null,
    hasOptions: false,
    availability: { state: "available" },
    addToCartVariantId: null,
    image: { url: "https://example.com/a.jpg", alt: "Producto" },
    ...overrides,
  };
}

describe("heroSlides", () => {
  it("picks the first photographed product per category, in category order", () => {
    const slides = heroSlides(
      [
        product({ id: "b", slug: "gel", name: "Gel", categorySlug: "cosmetica-intima" }),
        product({ id: "a", slug: "body", name: "Body" }),
        product({ id: "c", slug: "body-2", name: "Body 2" }),
      ],
      categories,
    );
    expect(slides.map((s) => s.href)).toEqual([
      "/tienda/body",
      "/tienda/gel",
    ]);
    expect(slides[0].categoryName).toBe("Lencería");
  });

  it("prefers an in-stock product over a sold-out one", () => {
    const slides = heroSlides(
      [
        product({ slug: "agotado", availability: { state: "out" } }),
        product({ slug: "disponible" }),
      ],
      categories,
    );
    expect(slides).toHaveLength(1);
    expect(slides[0].href).toBe("/tienda/disponible");
  });

  it("falls back to a sold-out product when nothing else has a photo", () => {
    const slides = heroSlides(
      [product({ slug: "agotado", availability: { state: "out" } })],
      categories,
    );
    expect(slides[0].href).toBe("/tienda/agotado");
  });

  it("drops categories without photographed products and returns [] for fixture-shaped input", () => {
    const slides = heroSlides(
      [product({ image: null }), product({ slug: "x", image: null })],
      categories,
    );
    expect(slides).toEqual([]);
  });
});
