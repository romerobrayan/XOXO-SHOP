import Link from "next/link";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import { Button } from "@/components/ui/button";
import { availabilityLabel } from "../availability";
import type { ProductCardDTO } from "../dto";
import { AddToCartButton } from "./AddToCartButton";
import { Price } from "./Price";

// Catalog card. Sold out is distinguishable by three signals — dimmed image,
// opaque badge, and the availability line — never by color alone. The CTA
// branches on the polymorphic option model: products with options route to
// the PDP, option-less products add directly (Tienda Cereza pattern).
export function ProductCard({ product }: { product: ProductCardDTO }) {
  const out = product.availability.state === "out";
  const badge = out
    ? "Agotado"
    : product.discountPercent
      ? `-${product.discountPercent}%`
      : null;

  return (
    <article className="flex flex-col gap-2">
      <Link
        href={`/tienda/${product.slug}`}
        className="group flex flex-col gap-2 rounded-xl"
      >
        <div className="relative">
          <div className={out ? "opacity-60" : undefined}>
            <ProductImagePlaceholder name={product.name} seed={product.slug} />
          </div>
          {badge && (
            <span
              className={
                out
                  ? "absolute top-2 left-2 rounded-md bg-ink px-2 py-1 font-mono text-micro uppercase text-bone"
                  : "absolute top-2 left-2 rounded-md bg-ember px-2 py-1 font-mono text-micro uppercase text-ink"
              }
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="font-mono text-micro uppercase text-bone/60">
            {product.brandName ?? product.categoryName ?? ""}
          </p>
          <h3 className="text-body font-medium text-bone group-hover:text-bone/80">
            {product.name}
          </h3>
          <Price
            cents={product.priceFromCents}
            compareAtCents={product.compareAtCents}
            from={product.priceVaries}
          />
          <p className="text-small text-bone/70">
            {availabilityLabel(product.availability)}
          </p>
        </div>
      </Link>
      {out ? (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/tienda/${product.slug}`}>Ver producto</Link>
        </Button>
      ) : product.hasOptions ? (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/tienda/${product.slug}`}>Elegir opciones</Link>
        </Button>
      ) : product.addToCartVariantId ? (
        <AddToCartButton variantId={product.addToCartVariantId} />
      ) : null}
    </article>
  );
}
