"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { countItems, useCart } from "../store";

// "Bolsa" + contador vino del header. La bolsa vive en el paso 1 del checkout,
// como en el handoff — no hay página de carrito separada. Icono sancionado por
// la guía ("bolsa"): Lucide outline, stroke 1.5, hereda el vino del link.
export function CartLink() {
  const count = useCart((s) => countItems(s.items));
  return (
    <Link
      href="/checkout"
      className="flex items-center gap-2 text-sm font-medium text-vino hover:text-cobre"
    >
      <ShoppingBag aria-hidden="true" strokeWidth={1.5} className="size-4" />
      Bolsa
      <Badge variant="vino" className="tabular min-w-7 justify-center">
        {count}
        <span className="sr-only">
          {count === 1 ? " producto en la bolsa" : " productos en la bolsa"}
        </span>
      </Badge>
    </Link>
  );
}
