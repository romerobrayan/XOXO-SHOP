import type { ProductCardDTO } from "../dto";
import { ProductCard } from "./ProductCard";

// "También te puede gustar": divisor de marca + grid de hasta 4 tarjetas.
// When the category has no other products the section does not render — an
// absent section, not an empty shelf.
export function RelatedProducts({ products }: { products: ProductCardDTO[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className="sr-only">
        También te puede gustar
      </h2>
      <div className="divisor">
        <span className="kicker whitespace-nowrap">
          También te puede gustar
        </span>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
        {products.slice(0, 4).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
