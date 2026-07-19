import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tienda" };

// Catalog (PLP) — Phase 0 placeholder. Renders seeded products from all three
// families once Sprint 2 wires the catalog queries.
export default function CatalogPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-title">Tienda</h1>
      <p className="text-body text-bone/80">
        El catálogo se conecta en el Sprint 2 — lencería, cosmética íntima y
        juguetería, con filtros por categoría y marca.
      </p>
    </section>
  );
}
