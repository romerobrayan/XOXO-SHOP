import Link from "next/link";

import { Button } from "@/components/ui/button";
import { BrandTile } from "@/features/catalog/components/BrandTile";
import { CategoryTile } from "@/features/catalog/components/CategoryTile";
import { DiscretionBlock } from "@/features/catalog/components/DiscretionBlock";
import { FeaturedProduct } from "@/features/catalog/components/FeaturedProduct";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { getBrands, getCategories, getProducts } from "@/features/catalog/queries";

const FEATURED_SLUG = "lovense-lush-3";

// Home — a shopwindow, not a brochure: real products above the fold behind a
// one-line utility strip, then promotions, discovery grid, categories, and
// brands. No slogan hero. The single glowing element is the featured CTA.
export default async function HomePage() {
  const [products, brands, categories] = await Promise.all([
    getProducts(),
    getBrands(),
    getCategories(),
  ]);

  const featured =
    products.find((p) => p.slug === FEATURED_SLUG) ?? products[0];
  const promos = products.filter(
    (p) => p.discountPercent !== null && p.availability.state !== "out",
  );
  const grid = products
    .filter((p) => p.id !== featured?.id && p.availability.state !== "out")
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-10">
      <h1 className="sr-only">XOXO — Tienda de productos para adultos</h1>

      <p className="text-small text-bone/70">
        Envío discreto a toda Colombia. Contra entrega en Medellín.
      </p>

      {featured && <FeaturedProduct product={featured} />}

      {promos.length > 0 && (
        <section aria-labelledby="promos-heading">
          <h2 id="promos-heading" className="text-title text-bone">
            Promociones
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {promos.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="available-heading">
        <h2 id="available-heading" className="text-title text-bone">
          Disponibles ahora
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {grid.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
        <Button variant="default" className="mt-6 w-full sm:w-auto" asChild>
          <Link href="/tienda">Ver toda la tienda</Link>
        </Button>
      </section>

      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="text-title text-bone">
          Categorías
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-3">
          {categories.map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>
      </section>

      <section aria-labelledby="brands-heading">
        <h2 id="brands-heading" className="text-title text-bone">
          Marcas
        </h2>
        <div className="mt-4 flex flex-col gap-3 sm:grid sm:grid-cols-3">
          {brands.map((brand) => (
            <BrandTile key={brand.id} brand={brand} />
          ))}
        </div>
      </section>

      <DiscretionBlock />
    </div>
  );
}
