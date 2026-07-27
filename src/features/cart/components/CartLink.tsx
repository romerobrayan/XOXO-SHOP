"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { countItems, useCart } from "../store";

// "Bolsa" + contador vino del header. La bolsa vive en el paso 1 del checkout,
// como en el handoff — no hay página de carrito separada.
export function CartLink() {
  const count = useCart((s) => countItems(s.items));
  return (
    <Link
      href="/checkout"
      className="flex items-center gap-2 text-sm font-medium text-vino hover:text-cobre"
    >
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
