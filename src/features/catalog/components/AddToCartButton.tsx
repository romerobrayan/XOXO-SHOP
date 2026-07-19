"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

// Phase 0 has no cart yet. The button is real and the feedback is honest —
// the same philosophy as the "Imagen pendiente" placeholder: the client
// reviews true state, never a simulation.
export function AddToCartButton({
  variantId,
  size = "sm",
}: {
  variantId: string;
  size?: "default" | "sm";
}) {
  const [noted, setNoted] = useState(false);
  return (
    <div className="flex w-full flex-col gap-1" data-variant-id={variantId}>
      <Button
        type="button"
        variant="outline"
        size={size}
        className="w-full"
        onClick={() => setNoted(true)}
      >
        Agregar al carrito
      </Button>
      <p aria-live="polite" className="min-h-4 font-mono text-micro text-bone/60">
        {noted ? "El carrito se activa en la próxima fase." : ""}
      </p>
    </div>
  );
}
