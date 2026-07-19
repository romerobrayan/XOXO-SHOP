import Link from "next/link";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import { Button } from "@/components/ui/button";
import type { ProductCardDTO } from "../dto";
import { Price } from "./Price";

// The home opener: one real product at full width — not a slogan hero. Its
// CTA is the single glowing element of the home view.
export function FeaturedProduct({ product }: { product: ProductCardDTO }) {
  return (
    <section aria-labelledby="featured-heading">
      <p className="font-mono text-micro uppercase text-mist">Destacado</p>
      <div className="mt-3 flex gap-4 rounded-xl bg-surface p-4 sm:gap-6 sm:p-6">
        <div className="w-[52%] shrink-0 sm:w-64">
          <ProductImagePlaceholder name={product.name} seed={product.slug} />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-1.5">
          <p className="font-mono text-micro uppercase text-bone/60">
            {product.brandName ?? product.categoryName ?? ""}
          </p>
          <h2 id="featured-heading" className="text-heading text-bone">
            {product.name}
          </h2>
          <Price
            cents={product.priceFromCents}
            compareAtCents={product.compareAtCents}
            from={product.priceVaries}
            size="lg"
          />
          <Button variant="neon" className="mt-2 w-full" asChild>
            <Link href={`/tienda/${product.slug}`}>Ver producto</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
