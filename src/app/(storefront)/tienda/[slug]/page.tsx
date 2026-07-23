import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DiscretionBlock } from "@/features/catalog/components/DiscretionBlock";
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

// Product detail — docs/DESIGN_BRIEF_PDP.md. Structure: gallery, identity,
// then the client island (price, picker, availability, add to cart), the
// discretion block right next to it, description, specs, shipping, related.
// The bottom padding clears the sticky CTA bar plus the iOS home indicator.
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

  return (
    <article className="flex flex-col gap-8 pb-[calc(5rem+env(safe-area-inset-bottom))] md:grid md:grid-cols-2 md:items-start md:gap-x-10">
      <div className="md:sticky md:top-8">
        <Gallery
          media={product.media}
          name={product.name}
          seed={product.slug}
        />
      </div>

      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <p className="font-mono text-micro uppercase text-bone/60">
            {product.brandName ?? product.categoryName ?? ""}
          </p>
          <h1 className="text-title text-bone">{product.name}</h1>
          {product.supplierRef && (
            <p className="tabular font-mono text-small text-bone/60">
              REF {product.supplierRef}
            </p>
          )}
        </header>

        <PurchasePanel product={product} />

        <DiscretionBlock />

        {product.description && (
          <section aria-labelledby="description-heading">
            <h2 id="description-heading" className="text-heading text-bone">
              Descripción
            </h2>
            <p className="mt-2 text-body text-bone/80">{product.description}</p>
          </section>
        )}

        <SpecsTable specs={product.specs} />

        <section aria-labelledby="shipping-heading">
          <h2 id="shipping-heading" className="text-heading text-bone">
            Envío y pago
          </h2>
          <div className="mt-2 flex flex-col gap-2 text-body text-bone/80">
            <p>Enviamos a toda Colombia.</p>
            <p>En Medellín puedes pagar contra entrega, al recibir el paquete.</p>
            <p>
              También aceptamos transferencia bancaria: subes tu comprobante,
              lo verificamos y confirmamos tu pedido.
            </p>
          </div>
        </section>
      </div>

      <div className="md:col-span-2">
        <RelatedProducts
          categoryName={product.categoryName ?? "la tienda"}
          products={related}
        />
      </div>
    </article>
  );
}
