import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { FilterChips, type FilterChip } from "@/features/catalog/components/FilterChips";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { getBrands, getCategories, getProducts } from "@/features/catalog/queries";

export const metadata: Metadata = { title: "Tienda" };

function catalogHref(categoria?: string, marca?: string) {
  const params = new URLSearchParams();
  if (categoria) params.set("categoria", categoria);
  if (marca) params.set("marca", marca);
  const query = params.toString();
  return query ? `/tienda?${query}` : "/tienda";
}

// Catalog (PLP). Filters are server-rendered links over searchParams — no
// client JS, shareable URLs, native keyboard support. Sold-out products stay
// in the grid, visible and distinguishable.
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoria =
    typeof params.categoria === "string" ? params.categoria : undefined;
  const marca = typeof params.marca === "string" ? params.marca : undefined;

  const [products, categories, brands] = await Promise.all([
    getProducts({ categorySlug: categoria, brandSlug: marca }),
    getCategories(),
    getBrands(),
  ]);

  const categoryChips: FilterChip[] = [
    {
      key: "todas",
      label: "Todas",
      href: catalogHref(undefined, marca),
      active: !categoria,
    },
    ...categories.map((c) => ({
      key: c.slug,
      label: c.name,
      href: catalogHref(c.slug, marca),
      active: categoria === c.slug,
    })),
  ];

  const brandChips: FilterChip[] = [
    {
      key: "todas",
      label: "Todas",
      href: catalogHref(categoria, undefined),
      active: !marca,
    },
    ...brands.map((b) => ({
      key: b.slug,
      label: b.name,
      href: catalogHref(categoria, b.slug),
      active: marca === b.slug,
    })),
  ];

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-title text-bone">Tienda</h1>
        <p className="tabular font-mono text-small text-bone/60">
          {products.length === 1 ? "1 producto" : `${products.length} productos`}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <FilterChips label="Categoría" chips={categoryChips} />
        <FilterChips label="Marca" chips={brandChips} />
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-start gap-4 py-8">
          <p className="text-body text-bone/80">
            No hay productos que coincidan con estos filtros.
          </p>
          <Button variant="outline" asChild>
            <Link href="/tienda">Quitar filtros</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}
