import type { Metadata } from "next";
import Link from "next/link";

import { ProductForm } from "@/features/products/components/ProductForm";
import { listBrandAndCategoryChoices } from "@/features/products/queries";

export const metadata: Metadata = {
  title: "Nuevo producto",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NuevoProductoPage() {
  const { brands, categories } = await listBrandAndCategoryChoices();

  return (
    <section className="grid max-w-2xl gap-6">
      <div>
        <Link
          href="/admin/productos"
          className="text-[13px] font-medium tracking-boton text-cuerpo uppercase transition-colors duration-150 hover:text-vino"
        >
          ← Productos
        </Link>
        <h1 className="mt-3 font-[family-name:--font-display] text-[32px]">
          Nuevo producto
        </h1>
        <p className="mt-1 text-sm font-light text-suave">
          Nace en borrador con una variante. Las opciones y el stock se agregan
          después de crearlo.
        </p>
      </div>
      <div className="rounded-[4px] border border-linea bg-crema p-5">
        <ProductForm brands={brands} categories={categories} />
      </div>
    </section>
  );
}
