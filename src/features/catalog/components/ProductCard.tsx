"use client";

import { faBagShopping, faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/store";
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
// Media + info are one target (with `onSelect` a button — home opens the
// product modal; without it, a link to the PDP), and the card closes with an
// explicit action row: add-to-bag for single-variant products ("Elegir
// opciones" routes to the PDP otherwise) plus "Ver detalle". The buttons keep
// a fixed size in every state — only the glyph swaps on feedback.
export function ProductCard({
  product,
  onSelect,
}: {
  product: ProductCardDTO;
  onSelect?: () => void;
}) {
  const out = product.availability.state === "out";
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2000);
    return () => clearTimeout(timer);
  }, [added]);

  function addToBag() {
    if (!product.addToCartVariantId) return;
    add({
      variantId: product.addToCartVariantId,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      kicker: cardKicker(product) || null,
      variantLabel: null,
      // Same URL the card is rendering — already the card crop.
      imageUrl: product.image?.url ?? null,
      priceCents: product.priceFromCents,
    });
    setAdded(true);
  }

  const body = (
    <>
      <div className={cn("relative", out && "opacity-60")}>
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers pre-sized assets
          <img
            src={product.image.url}
            alt={product.image.alt}
            loading="lazy"
            className="aspect-[4/5] w-full bg-arena object-contain object-center"
          />
        ) : (
          <ProductImagePlaceholder
            name={product.name}
            className="rounded-none"
          />
        )}
        {out ? (
          <Badge className="absolute top-3 left-3">Agotado</Badge>
        ) : product.discountPercent ? (
          <Badge variant="oro" className="absolute top-3 left-3">
            -{product.discountPercent}%
          </Badge>
        ) : null}
      </div>
      {/* flex-1 + mt-auto keep every card in a row the same height: the name
          reserves exactly two lines and the price row sits on the bottom
          edge regardless of how short the name is. */}
      <div className="flex flex-1 flex-col p-4 pb-0">
        {/* One line always: long category·brand pairs must not break the
            card rhythm down the grid. */}
        <p className="kicker truncate">{cardKicker(product)}</p>
        <h3 className="mt-1.5 line-clamp-2 min-h-[3.3em] font-display text-lg font-normal text-tinta">
          {product.name}
        </h3>
        {/* Narrow cards can't fit "Desde $16.500 · Envío discreto" on one
            line, and a wrapped price made rows uneven — so mobile stacks the
            footer (always two real lines, always the same height) and md+
            returns to the handoff's single price/note row. */}
        <div className="mt-auto flex flex-col gap-1 pt-2.5 md:flex-row md:items-baseline md:justify-between md:gap-2">
          <Price
            className="min-w-0 flex-nowrap"
            cents={product.priceFromCents}
            compareAtCents={product.compareAtCents}
            from={product.priceVaries}
          />
          <span className="shrink-0 text-xs whitespace-nowrap text-tenue">
            {out ? "Agotado" : "Envío discreto"}
          </span>
        </div>
      </div>
    </>
  );

  const mediaClass = "flex w-full flex-1 flex-col text-left";

  return (
    <article className="flex h-full w-full flex-col overflow-hidden rounded-md border border-linea bg-crema transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card">
      {onSelect ? (
        <button type="button" onClick={onSelect} className={mediaClass}>
          {body}
        </button>
      ) : (
        <Link href={`/tienda/${product.slug}`} className={mediaClass}>
          {body}
        </Link>
      )}
      <div className="flex flex-col gap-2 p-4">
        {out ? (
          <Button size="sm" disabled>
            Agotado
          </Button>
        ) : product.addToCartVariantId ? (
          <Button size="sm" onClick={addToBag}>
            <FontAwesomeIcon
              icon={added ? faCheck : faBagShopping}
              aria-hidden="true"
              className="size-4"
            />
            Agregar
          </Button>
        ) : (
          <Button size="sm" asChild>
            <Link href={`/tienda/${product.slug}`}>Elegir opciones</Link>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <Link href={`/tienda/${product.slug}`}>Ver detalle</Link>
        </Button>
        <span aria-live="polite" className="sr-only">
          {added ? "Agregado a tu bolsa." : ""}
        </span>
      </div>
    </article>
  );
}
