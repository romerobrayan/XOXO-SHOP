import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ArchiveToggle } from "@/features/products/components/ArchiveToggle";
import { listAdminProducts } from "@/features/products/queries";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Productos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "default" | "exito" | "error" }
> = {
  DRAFT: { label: "Borrador", variant: "default" },
  ACTIVE: { label: "Publicado", variant: "exito" },
  ARCHIVED: { label: "Archivado", variant: "error" },
};

export default async function ProductosPage() {
  const products = await listAdminProducts();

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:--font-display] text-[32px]">
            Productos
          </h1>
          <p className="mt-1 text-sm font-light text-suave">
            {products.length} producto{products.length === 1 ? "" : "s"} en el
            catálogo.
          </p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Nuevo producto
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded-[4px] border border-linea bg-crema p-6 text-sm font-light text-suave">
          Sin productos todavía.
        </p>
      ) : (
        <ul className="grid gap-2">
          {products.map((product) => {
            const active = product.variants.filter((v) => v.isActive);
            const available = active.reduce(
              (sum, v) => sum + (v.stockOnHand - v.stockReserved),
              0,
            );
            const low = active.some(
              (v) =>
                v.stockOnHand - v.stockReserved > 0 &&
                v.stockOnHand - v.stockReserved <= v.lowStockAt,
            );
            const badge = STATUS_BADGE[product.status];
            return (
              <li
                key={product.id}
                className="grid gap-2 rounded-[4px] border border-linea bg-crema p-4 transition-shadow duration-150 hover:shadow-card sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <Link
                  href={`/admin/productos/${product.id}`}
                  className="grid gap-1"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{product.name}</span>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                    {available === 0 && product.status === "ACTIVE" ? (
                      <Badge variant="error">Agotado</Badge>
                    ) : low ? (
                      <Badge variant="oro">Poco stock</Badge>
                    ) : null}
                  </div>
                  <span className="text-sm font-light text-suave">
                    {[product.brand?.name, product.category?.name]
                      .filter(Boolean)
                      .join(" · ") || "Sin marca ni categoría"}
                    {" · "}
                    {product.variants.length} variante
                    {product.variants.length === 1 ? "" : "s"}
                  </span>
                </Link>
                <div className="grid gap-1 sm:justify-items-end">
                  <span className="font-semibold text-vino tabular-nums">
                    {formatCOP(product.minPriceCents)}
                  </span>
                  <span className="text-[13px] font-light text-tenue tabular-nums">
                    {available} disponible{available === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="justify-self-start sm:justify-self-end">
                  <ArchiveToggle
                    productId={product.id}
                    status={product.status}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
