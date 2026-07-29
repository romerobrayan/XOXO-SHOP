"use client";

import Link from "next/link";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProductCardDTO } from "../dto";
import { Price } from "./Price";

export function cardKicker(product: ProductCardDTO): string {
  return [product.categoryName, product.brandName].filter(Boolean).join(" · ");
}

// .card-producto del design system: crema, borde línea, media 4:5 en arena,
// nombre en Marcellus, precio vino + nota "Envío discreto". Hover eleva 2px
// con la única sombra de tarjeta del sistema. Sold out keeps three non-color
// signals: dimmed media, explicit badge, and "Agotado" text.
//
// The whole card is one target. With `onSelect` it becomes a button (home
// opens the product modal); without it, a link to the PDP (catálogo).
export function ProductCard({
  product,
  onSelect,
}: {
  product: ProductCardDTO;
  onSelect?: () => void;
}) {
  const out = product.availability.state === "out";

  const body = (
    <>
      <div className={cn("relative", out && "opacity-60")}>
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers pre-sized assets
          <img
            src={product.image.url}
            alt={product.image.alt}
            loading="lazy"
            className="aspect-[4/5] w-full bg-arena object-cover"
          />
        ) : (
          <ProductImagePlaceholder name={product.name} className="rounded-none" />
        )}
        {out ? (
          <Badge className="absolute top-3 left-3">Agotado</Badge>
        ) : product.discountPercent ? (
          <Badge variant="oro" className="absolute top-3 left-3">
            -{product.discountPercent}%
          </Badge>
        ) : null}
      </div>
      <div className="p-4">
        {/* One line always: long category·brand pairs must not break the
            card rhythm down the grid. */}
        <p className="kicker truncate">{cardKicker(product)}</p>
        <h3 className="mt-1.5 font-display text-lg font-normal text-tinta">
          {product.name}
        </h3>
        <div className="mt-2.5 flex items-baseline justify-between gap-2">
          <Price
            cents={product.priceFromCents}
            compareAtCents={product.compareAtCents}
            from={product.priceVaries}
          />
          <span className="text-xs text-tenue">
            {out ? "Agotado" : "Envío discreto"}
          </span>
        </div>
      </div>
    </>
  );

  const cardClass =
    "block w-full overflow-hidden rounded-md border border-linea bg-crema text-left transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card";

  if (onSelect) {
    return (
      <article>
        <button type="button" onClick={onSelect} className={cardClass}>
          {body}
        </button>
      </article>
    );
  }
  return (
    <article>
      <Link href={`/tienda/${product.slug}`} className={cardClass}>
        {body}
      </Link>
    </article>
  );
}
