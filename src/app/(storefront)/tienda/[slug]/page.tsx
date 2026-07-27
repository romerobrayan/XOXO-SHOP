import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/site/Breadcrumb";
import { Gallery } from "@/features/catalog/components/Gallery";
import { PurchasePanel } from "@/features/catalog/components/PurchasePanel";
import { RelatedProducts } from "@/features/catalog/components/RelatedProducts";
import { SpecsTable } from "@/features/catalog/components/SpecsTable";
import { getProductBySlug, getProducts } from "@/features/catalog/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return { title: product?.name ?? "Producto" };
}

const summaryClass =
  "cursor-pointer font-display text-lg text-tinta transition-colors hover:text-vino";

// Detalle de producto per handoff §3: breadcrumb, galería | info, acordeones
// con la discreción primero (abierta por defecto) y relacionados al cierre.
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = product.categorySlug
    ? (await getProducts({ categorySlug: product.categorySlug })).filter(
        (p) => p.id !== product.id,
      )
    : [];

  // "Cuidado" gets its own accordion per the handoff; the rest stays in the
  // specs list, closed by the supplier reference when one exists.
  const careSpec = product.specs.find((s) =>
    s.label.toLowerCase().startsWith("cuidado"),
  );
  const specRows = [
    ...product.specs.filter((s) => s !== careSpec),
    ...(product.supplierRef
      ? [{ label: "Referencia", value: `REF ${product.supplierRef}` }]
      : []),
  ];

  const kicker = [product.categoryName, product.brandName]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto w-full max-w-content px-4 py-8 md:px-6">
      <Breadcrumb
        items={[
          { label: "Inicio", href: "/" },
          product.categoryName && product.categorySlug
            ? {
                label: product.categoryName,
                href: `/tienda?categoria=${product.categorySlug}`,
              }
            : { label: "Catálogo", href: "/tienda" },
          { label: product.name },
        ]}
      />

      <article className="mt-6 grid items-start gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <Gallery media={product.media} name={product.name} />

        <div className="flex flex-col gap-4">
          <header className="flex flex-col gap-4">
            {kicker && <p className="kicker">{kicker}</p>}
            <h1 className="text-2xl md:text-3xl">{product.name}</h1>
          </header>

          <PurchasePanel product={product} />

          <div className="mt-3 border-t border-linea">
            <details open className="border-b border-linea py-4">
              <summary className={summaryClass}>Así llega tu pedido</summary>
              <p className="mt-3 font-light">
                Caja neutra sin logos ni descripción del contenido, remitente
                genérico y factura discreta. Nadie sabrá qué llegó — esa es la
                promesa.
              </p>
            </details>
            {specRows.length > 0 && (
              <details className="border-b border-linea py-4">
                <summary className={summaryClass}>Especificaciones</summary>
                <SpecsTable specs={specRows} />
              </details>
            )}
            {careSpec && (
              <details className="border-b border-linea py-4">
                <summary className={summaryClass}>Cuidado y limpieza</summary>
                <p className="mt-3 font-light">{careSpec.value}.</p>
              </details>
            )}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <div className="mt-16">
          <RelatedProducts products={related} />
        </div>
      )}
    </div>
  );
}
