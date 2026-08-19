"use client";

import { faBagShopping } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useState } from "react";

import { ProductImagePlaceholder } from "@/components/commerce/ProductImagePlaceholder";
import { WhatsAppCta } from "@/components/commerce/WhatsAppCta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/features/cart/store";
import type { ProductCardDTO } from "../dto";
import { cardKicker, ProductCard } from "./ProductCard";
import { Price } from "./Price";

// Grid "Top ventas" de la home: la tarjeta abre el modal de producto del
// handoff (overlay tinta, tarjeta crema en dos columnas). "Ver detalle
// completo" navega a la PDP; agregar solo aplica a productos sin opciones —
// con opciones, la elección vive en la PDP.
export function HomeShowcase({ products }: { products: ProductCardDTO[] }) {
  const [active, setActive] = useState<ProductCardDTO | null>(null);
  const add = useCart((s) => s.add);

  function addActive() {
    if (!active?.addToCartVariantId) return;
    add({
      variantId: active.addToCartVariantId,
      productId: active.id,
      slug: active.slug,
      name: active.name,
      kicker: cardKicker(active) || null,
      variantLabel: null,
      // Same URL the modal is rendering — already the card crop.
      imageUrl: active.image?.url ?? null,
      priceCents: active.priceFromCents,
    });
    setActive(null);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onSelect={() => setActive(product)}
          />
        ))}
      </div>

      <Dialog
        open={active !== null}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      >
        <DialogContent className="max-w-[760px] gap-0 overflow-hidden p-0 sm:grid sm:grid-cols-2">
          {active && (
            <>
              {active.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivers pre-sized assets
                <img
                  src={active.image.url}
                  alt={active.image.alt}
                  className="hidden h-full w-full bg-arena object-contain object-center sm:block"
                />
              ) : (
                <ProductImagePlaceholder
                  name={active.name}
                  className="hidden aspect-auto h-full rounded-none sm:flex"
                />
              )}
              <div className="flex flex-col gap-4 p-6 md:p-8">
                <p className="kicker">{cardKicker(active)}</p>
                <DialogTitle className="text-2xl">{active.name}</DialogTitle>
                <Price
                  cents={active.priceFromCents}
                  compareAtCents={active.compareAtCents}
                  from={active.priceVaries}
                  size="lg"
                />
                <DialogDescription>
                  {active.description ??
                    "Consulta el detalle completo del producto."}
                </DialogDescription>
                <div className="flex flex-wrap gap-2">
                  <Badge>Empaque neutro</Badge>
                  <Badge>Garantía 6 meses</Badge>
                </div>
                <div className="mt-2 flex flex-col gap-2">
                  {active.availability.state === "out" ? (
                    <Button disabled>Agotado</Button>
                  ) : active.addToCartVariantId ? (
                    <Button onClick={addActive}>
                      <FontAwesomeIcon
                        icon={faBagShopping}
                        aria-hidden="true"
                        className="size-4"
                      />
                      Agregar al carrito
                    </Button>
                  ) : (
                    <Button asChild>
                      <Link href={`/tienda/${active.slug}`}>
                        Elegir opciones
                      </Link>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <Link href={`/tienda/${active.slug}`}>
                      Ver detalle completo
                    </Link>
                  </Button>
                  <WhatsAppCta
                    message={`Hola, tengo una pregunta sobre ${active.name}`}
                    className="w-full"
                  >
                    Preguntar por WhatsApp
                  </WhatsAppCta>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
