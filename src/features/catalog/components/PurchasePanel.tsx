"use client";

import { faBagShopping } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useState } from "react";

import { WhatsAppCta } from "@/components/commerce/WhatsAppCta";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCart } from "@/features/cart/store";
import { availabilityLabel, bandFor } from "../availability";
import { coverImage } from "../cover";
import type { ProductDetailDTO } from "../dto";
import {
  defaultSelection,
  mediaForSelection,
  priceRange,
  variantForSelection,
} from "../pickerState";
import { OptionPicker } from "./OptionPicker";
import { Price } from "./Price";

// Client island for everything that reacts to variant selection: price,
// badge de estado, picker, stepper de cantidad y el CTA — per handoff §3.
// Agotado: CTA deshabilitado y el WhatsApp pill pregunta por el regreso; el
// canal real del negocio responde mejor que un aviso simulado.
export function PurchasePanel({ product }: { product: ProductDetailDTO }) {
  const { options, variants } = product;
  const [selection, setSelection] = useState(() =>
    defaultSelection(options, variants),
  );
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);

  const variant = variantForSelection(options, variants, selection);
  const band = variant ? bandFor(variant.available, variant.lowStockAt) : null;
  const out = !variant || band?.state === "out";

  // The photo that travels into the bag follows the selection, so a bag row
  // for "Negro" shows the black one when color-specific photography exists
  // (ProductMedia.optionValueId). Falls back to the product cover, then to
  // null — which renders the placeholder, never a stand-in photo.
  const cover = coverImage(mediaForSelection(product.media, selection));

  const range = priceRange(variants);
  const priceCents = variant ? variant.priceCents : range.min;
  const maxQty = variant && variant.available > 0 ? variant.available : 1;
  const shownQty = Math.min(qty, maxQty);

  function select(optionId: string, valueId: string) {
    setSelection((prev) => ({ ...prev, [optionId]: valueId }));
    setQty(1);
    setAdded(false);
  }

  function addToBag() {
    if (!variant || out) return;
    const variantLabel =
      options
        .map((o) => o.values.find((v) => v.id === selection[o.id])?.value)
        .filter(Boolean)
        .join(" · ") || null;
    add(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        kicker:
          [product.categoryName, product.brandName]
            .filter(Boolean)
            .join(" · ") || null,
        variantLabel,
        imageUrl: cover?.url ?? null,
        priceCents: variant.priceCents,
      },
      shownQty,
    );
    setAdded(true);
  }

  const stateBadge = !variant ? (
    <Badge variant="error">No disponible</Badge>
  ) : band!.state === "out" ? (
    <Badge variant="error">
      {options.length > 0 ? "Agotado en esta combinación" : "Agotado"}
    </Badge>
  ) : (
    <Badge variant="exito">{availabilityLabel(band!)}</Badge>
  );

  const stepperButton =
    "flex h-11 w-11 items-center justify-center text-lg text-cuerpo transition-colors hover:text-vino disabled:pointer-events-none disabled:opacity-45";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <Price
          cents={priceCents}
          compareAtCents={variant?.compareAtCents ?? null}
          from={!variant && range.min !== range.max}
          size="lg"
        />
        {stateBadge}
      </div>

      {product.description && (
        <p className="font-light">{product.description}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Badge>Empaque neutro</Badge>
        <Badge>Remitente genérico</Badge>
        <Badge>Garantía 6 meses</Badge>
      </div>

      <OptionPicker
        options={options}
        variants={variants}
        selection={selection}
        onSelect={select}
      />

      <div className="mt-1 flex items-stretch gap-3">
        <div className="flex items-center rounded-sm border border-linea bg-crema">
          <button
            type="button"
            className={stepperButton}
            disabled={out || shownQty <= 1}
            onClick={() => {
              setQty(Math.max(1, shownQty - 1));
              setAdded(false);
            }}
          >
            <span aria-hidden="true">−</span>
            <span className="sr-only">Reducir cantidad</span>
          </button>
          <span
            aria-live="polite"
            className="tabular min-w-8 text-center font-semibold text-tinta"
          >
            {shownQty}
            <span className="sr-only"> unidades</span>
          </span>
          <button
            type="button"
            className={stepperButton}
            disabled={out || shownQty >= maxQty}
            onClick={() => {
              setQty(Math.min(maxQty, shownQty + 1));
              setAdded(false);
            }}
          >
            <span aria-hidden="true">+</span>
            <span className="sr-only">Aumentar cantidad</span>
          </button>
        </div>
        {out ? (
          <Button disabled className="flex-1">
            Agotado
          </Button>
        ) : (
          <Button onClick={addToBag} className="flex-1">
            <FontAwesomeIcon
              icon={faBagShopping}
              aria-hidden="true"
              className="size-4"
            />
            Agregar al carrito
          </Button>
        )}
      </div>
      <p aria-live="polite" className="min-h-5 text-sm text-exito">
        {added && (
          <>
            Agregado a tu bolsa.{" "}
            <Link
              href="/checkout"
              className="font-medium text-vino hover:text-cobre"
            >
              Ver bolsa →
            </Link>
          </>
        )}
      </p>

      <WhatsAppCta
        message={
          out
            ? `Hola, ¿cuándo vuelve ${product.name}?`
            : `Hola, tengo una pregunta sobre ${product.name}`
        }
        className="w-full"
      >
        ¿Dudas? Pregunta en privado por WhatsApp
      </WhatsAppCta>
    </div>
  );
}
