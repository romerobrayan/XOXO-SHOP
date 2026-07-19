import type { Metadata } from "next";

export const metadata: Metadata = { title: "Producto" };

// Product detail (PDP) — Phase 0 placeholder. The real page follows
// docs/DESIGN_BRIEF_PDP.md: gallery, identity block, price, option picker
// (three states, one component), availability, add to cart, discretion block,
// specs, shipping, related products.
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-title">Producto</h1>
      <p className="font-mono text-small text-bone/50">{slug}</p>
    </section>
  );
}
