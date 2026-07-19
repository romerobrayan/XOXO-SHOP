"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { availabilityLabel, bandFor } from "../availability";
import type { ProductDetailDTO } from "../dto";
import {
  defaultSelection,
  priceRange,
  variantForSelection,
} from "../pickerState";
import { OptionPicker } from "./OptionPicker";
import { Price } from "./Price";

// Client island for everything that reacts to variant selection: price,
// picker, availability, and the add-to-cart CTA — the ONE glowing element of
// the PDP. When the selected combination is sold out the CTA becomes a quiet
// outline invitation and the view has no glow at all (one is the maximum,
// not the minimum). The sticky bar mirrors whichever state is current.
export function PurchasePanel({ product }: { product: ProductDetailDTO }) {
  const { options, variants } = product;
  const [selection, setSelection] = useState(() =>
    defaultSelection(options, variants),
  );
  const [note, setNote] = useState<string | null>(null);

  const variant = variantForSelection(options, variants, selection);
  const band = variant ? bandFor(variant.available, variant.lowStockAt) : null;
  const out = !variant || band?.state === "out";

  const range = priceRange(variants);
  const priceCents = variant ? variant.priceCents : range.min;
  const compareAtCents = variant?.compareAtCents ?? null;

  // Sticky bar: purely visual convenience, shown only after the real CTA
  // scrolls out. aria-hidden + inert keep it out of the accessibility tree
  // and tab order — screen readers and keyboards only ever see one CTA.
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaOffscreen, setCtaOffscreen] = useState(false);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setCtaOffscreen(!entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function select(optionId: string, valueId: string) {
    setSelection((prev) => ({ ...prev, [optionId]: valueId }));
    setNote(null);
  }

  const availabilityText = !variant
    ? "No disponible en esta combinación"
    : band!.state === "out"
      ? options.length > 0
        ? "Agotado en esta combinación"
        : "Agotado"
      : availabilityLabel(band!);

  const cta = out ? (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => setNote("Los avisos de disponibilidad se activan en la próxima fase.")}
    >
      Avísame cuando vuelva
    </Button>
  ) : (
    <Button
      variant="neon"
      className="w-full"
      onClick={() => setNote("El carrito se activa en la próxima fase.")}
    >
      Agregar al carrito
    </Button>
  );

  return (
    <div className="flex flex-col gap-5">
      <Price
        cents={priceCents}
        compareAtCents={compareAtCents}
        from={!variant && range.min !== range.max}
        size="lg"
      />

      <OptionPicker
        options={options}
        variants={variants}
        selection={selection}
        onSelect={select}
      />

      <p className="flex items-center gap-2 text-small text-bone/70">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full",
            out ? "bg-ember" : "bg-blush",
          )}
        />
        {availabilityText}
      </p>

      <div ref={ctaRef} className="flex flex-col gap-1">
        {cta}
        <p
          aria-live="polite"
          className="min-h-4 text-center font-mono text-micro text-bone/60"
        >
          {note ?? ""}
        </p>
      </div>

      <div
        aria-hidden="true"
        inert
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-bone/10 bg-ink/95 transition-transform",
          ctaOffscreen ? "translate-y-0" : "translate-y-full",
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Price cents={priceCents} compareAtCents={compareAtCents} />
          <div className="w-1/2">
            {out ? (
              <Button variant="outline" size="sm" className="w-full">
                Avísame cuando vuelva
              </Button>
            ) : (
              <Button variant="neon" size="sm" className="w-full">
                Agregar al carrito
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
