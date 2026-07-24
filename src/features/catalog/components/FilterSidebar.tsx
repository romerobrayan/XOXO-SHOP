import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BrandSummary, CategorySummary } from "../dto";

export type CatalogParams = {
  categoria?: string;
  marca?: string;
  orden?: string;
};

export function catalogHref(params: CatalogParams): string {
  const search = new URLSearchParams();
  if (params.categoria) search.set("categoria", params.categoria);
  if (params.marca) search.set("marca", params.marca);
  if (params.orden) search.set("orden", params.orden);
  const query = search.toString();
  return query ? `/tienda?${query}` : "/tienda";
}

function FilterLink({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "text-sm",
        active
          ? "font-semibold text-vino"
          : "text-cuerpo hover:text-vino",
      )}
    >
      {label}
      {active && <span aria-hidden="true"> ✕</span>}
    </Link>
  );
}

// Sidebar de filtros del catálogo: links toggle server-rendered sobre
// searchParams (URLs compartibles, cero JS) — el activo va en vino semibold
// con "✕" y el mismo href lo des-selecciona. Cierra con los badges de
// promesas, como en el handoff.
export function FilterSidebar({
  categories,
  brands,
  params,
}: {
  categories: CategorySummary[];
  brands: BrandSummary[];
  params: CatalogParams;
}) {
  return (
    <div className="grid gap-8">
      <div>
        <p className="kicker mb-3">Categoría</p>
        <div className="grid gap-2">
          {categories.map((c) => {
            const active = params.categoria === c.slug;
            return (
              <FilterLink
                key={c.id}
                label={c.name}
                active={active}
                href={catalogHref({
                  ...params,
                  categoria: active ? undefined : c.slug,
                })}
              />
            );
          })}
        </div>
      </div>
      <div>
        <p className="kicker mb-3">Marca</p>
        <div className="grid gap-2">
          {brands.map((b) => {
            const active = params.marca === b.slug;
            return (
              <FilterLink
                key={b.id}
                label={b.name}
                active={active}
                href={catalogHref({
                  ...params,
                  marca: active ? undefined : b.slug,
                })}
              />
            );
          })}
        </div>
      </div>
      <div>
        <p className="kicker mb-3">Promesas</p>
        <div className="grid justify-items-start gap-2">
          <Badge>Empaque neutro</Badge>
          <Badge>Contra entrega Medellín</Badge>
          <Badge variant="exito">Garantía 6 meses</Badge>
        </div>
      </div>
    </div>
  );
}
