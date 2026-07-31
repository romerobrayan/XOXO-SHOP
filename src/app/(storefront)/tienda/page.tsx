import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumb } from "@/components/site/Breadcrumb";
import { Button } from "@/components/ui/button";
import {
  catalogHref,
  FilterSidebar,
} from "@/features/catalog/components/FilterSidebar";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { SortSelect } from "@/features/catalog/components/SortSelect";
import { SORT_OPTIONS, type SortValue } from "@/features/catalog/sort";
import {
  getBrands,
  getCategories,
  getProducts,
} from "@/features/catalog/queries";

export const metadata: Metadata = { title: "Catálogo" };

// Catálogo per handoff §2: breadcrumb, kicker + título Marcellus, orden por
// URL, sidebar sticky de filtros toggle y grid de 3 columnas con contador.
// Sold-out products stay in the grid, visible and distinguishable.
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categoria =
    typeof params.categoria === "string" ? params.categoria : undefined;
  const marca = typeof params.marca === "string" ? params.marca : undefined;
  const orden: SortValue = SORT_OPTIONS.some((o) => o.value === params.orden)
    ? (params.orden as SortValue)
    : "relevancia";

  const [products, categories, brands] = await Promise.all([
    getProducts({ categorySlug: categoria, brandSlug: marca }),
    getCategories(),
    getBrands(),
  ]);

  const sorted = [...products];
  if (orden === "precio-asc") {
    sorted.sort((a, b) => a.priceFromCents - b.priceFromCents);
  } else if (orden === "precio-desc") {
    sorted.sort((a, b) => b.priceFromCents - a.priceFromCents);
  }

  const activeFilterNames = [
    categories.find((c) => c.slug === categoria)?.name,
    brands.find((b) => b.slug === marca)?.name,
  ].filter(Boolean);
  const counter = [
    sorted.length === 1 ? "1 producto" : `${sorted.length} productos`,
    ...activeFilterNames,
  ].join(" · ");

  const filterParams = { categoria, marca, orden: params.orden as string };

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8 md:px-6">
      <Breadcrumb
        items={[{ label: "Inicio", href: "/" }, { label: "Catálogo" }]}
      />

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="kicker">La colección</p>
          <h1 className="mt-2 text-2xl md:text-3xl">Catálogo</h1>
        </div>
        <SortSelect value={orden} />
      </div>

      <div className="mt-8 items-start gap-12 lg:grid lg:grid-cols-[230px_1fr]">
        <details className="mb-6 rounded-md border border-linea bg-crema p-4 lg:hidden">
          <summary className="cursor-pointer text-sm font-medium text-vino">
            Filtrar
          </summary>
          <div className="mt-4">
            <FilterSidebar
              categories={categories}
              brands={brands}
              params={filterParams}
            />
          </div>
        </details>
        <aside className="hidden lg:sticky lg:top-28 lg:block">
          <FilterSidebar
            categories={categories}
            brands={brands}
            params={filterParams}
          />
        </aside>

        <div>
          <p className="mb-4 text-sm text-suave">{counter}</p>
          {sorted.length === 0 ? (
            <div className="flex flex-col items-start gap-4 py-8">
              <p className="font-light">
                No hay productos que coincidan con estos filtros.
              </p>
              <Button variant="outline" asChild>
                <Link href={catalogHref({})}>Quitar filtros</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
              {sorted.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
