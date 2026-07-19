import Link from "next/link";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import type { ProductCardDTO } from "../dto";
import { Price } from "./Price";

// Same-category discovery row, up to four compact cards. When the category
// has no other products the section does not render — an absent section, not
// an empty shelf.
export function RelatedProducts({
  categoryName,
  products,
}: {
  categoryName: string;
  products: ProductCardDTO[];
}) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-heading text-bone">
        También en {categoryName}
      </h2>
      <div className="scroll-row -mx-4 mt-3 flex gap-3 overflow-x-auto px-4 py-1.5">
        {products.slice(0, 4).map((product) => (
          <Link
            key={product.id}
            href={`/tienda/${product.slug}`}
            className="flex w-36 shrink-0 flex-col gap-1.5 rounded-xl"
          >
            <ProductImagePlaceholder name={product.name} seed={product.slug} />
            <p className="text-small text-bone">{product.name}</p>
            <Price
              cents={product.priceFromCents}
              compareAtCents={product.compareAtCents}
              from={product.priceVaries}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
