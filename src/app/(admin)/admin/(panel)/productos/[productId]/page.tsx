import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MediaManager } from "@/features/products/components/MediaManager";
import { OptionsEditor } from "@/features/products/components/OptionsEditor";
import { ProductForm } from "@/features/products/components/ProductForm";
import { ProductLifecycle } from "@/features/products/components/ProductLifecycle";
import { VariantsTable } from "@/features/products/components/VariantsTable";
import {
  getAdminProduct,
  listBrandAndCategoryChoices,
} from "@/features/products/queries";

export const metadata: Metadata = {
  title: "Producto",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const [product, { brands, categories }] = await Promise.all([
    getAdminProduct(productId),
    listBrandAndCategoryChoices(),
  ]);

  if (!product) notFound();

  const hasOptionValues = product.options.some((o) => o.values.length > 0);

  return (
    <section className="grid gap-6">
      <div>
        <Link
          href="/admin/productos"
          className="text-[13px] font-medium tracking-boton text-cuerpo uppercase transition-colors duration-150 hover:text-vino"
        >
          ← Productos
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="font-[family-name:--font-display] text-[32px]">
            {product.name}
          </h1>
          {product.status === "ACTIVE" ? (
            <Link
              href={`/tienda/${product.slug}`}
              className="text-[13px] font-medium tracking-boton text-cobre uppercase transition-colors duration-150 hover:text-vino"
            >
              Ver en la tienda →
            </Link>
          ) : null}
        </div>
      </div>

      <Card title="Datos">
        <ProductForm
          brands={brands}
          categories={categories}
          product={{
            id: product.id,
            name: product.name,
            description: product.description,
            status: product.status,
            supplierRef: product.supplierRef,
            brandId: product.brandId,
            categoryId: product.categoryId,
          }}
        />
      </Card>

      <Card title="Fotos">
        <MediaManager productId={product.id} media={product.media} />
      </Card>

      <Card title="Opciones">
        <OptionsEditor productId={product.id} options={product.options} />
      </Card>

      <Card title="Variantes y stock">
        <VariantsTable
          productId={product.id}
          hasOptionValues={hasOptionValues}
          variants={product.variants}
        />
      </Card>

      <Card title="Archivar o eliminar">
        <ProductLifecycle
          productId={product.id}
          status={product.status}
          hasHistory={product.hasHistory}
        />
      </Card>
    </section>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[4px] border border-linea bg-crema p-5">
      <h2 className="mb-4 text-[12px] font-medium tracking-kicker text-cobre uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}
