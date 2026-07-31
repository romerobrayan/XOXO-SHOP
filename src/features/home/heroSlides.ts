import type { CategorySummary, ProductCardDTO } from "@/features/catalog/dto";

// The hero escaparate: one real product photo per category, in category
// position order (lencería → cosmética → juguetería). Pure so it is testable
// and so the home page stays a server component that just passes props.

export type HeroSlide = {
  categoryName: string;
  productName: string;
  /** The photo shows a specific product, so it links there — "products one
   * tap away" is the spec's stated intent for the home. */
  href: string;
  /** Already card-transformed by the DTO (crop-to-fill 4:5). */
  imageUrl: string;
  imageAlt: string;
};

// Categories with no photographed product drop out; fixtures mode ships no
// media at all, so this returns [] and the hero falls back to the approved
// static placeholder.
export function heroSlides(
  products: ProductCardDTO[],
  categories: CategorySummary[],
): HeroSlide[] {
  return categories.flatMap((category) => {
    const pool = products.filter(
      (p) => p.categorySlug === category.slug && p.image !== null,
    );
    const pick = pool.find((p) => p.availability.state !== "out") ?? pool[0];
    if (!pick?.image) return [];
    return [
      {
        categoryName: category.name,
        productName: pick.name,
        href: `/tienda/${pick.slug}`,
        imageUrl: pick.image.url,
        imageAlt: pick.image.alt,
      },
    ];
  });
}
