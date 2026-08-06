"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ProductStatus } from "@/generated/prisma/enums";
import { createProduct, updateProduct } from "../actions";

const labelClass = "mb-2 block text-sm font-medium text-cuerpo";

type Choice = { id: string; name: string };

type Props = {
  brands: Choice[];
  categories: Choice[];
  product?: {
    id: string;
    name: string;
    description: string | null;
    status: ProductStatus;
    supplierRef: string | null;
    brandId: string | null;
    categoryId: string | null;
  };
};

export function ProductForm({ brands, categories, product }: Props) {
  const router = useRouter();
  const isNew = !product;

  const [form, setForm] = useState({
    name: product?.name ?? "",
    description: product?.description ?? "",
    brandId: product?.brandId ?? "",
    categoryId: product?.categoryId ?? "",
    supplierRef: product?.supplierRef ?? "",
    status: product?.status ?? ("DRAFT" as ProductStatus),
    sku: "",
    price: "",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const create = useAction(createProduct, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.ok) {
        router.push(`/admin/productos/${data.productId}`);
        return;
      }
      setError("Ese SKU ya existe en otro producto.");
    },
    onError: () => setError("No pudimos crear el producto."),
  });

  const update = useAction(updateProduct, {
    onSuccess({ data }) {
      if (data && "ok" in data && data.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError("No pudimos guardar los cambios.");
      }
    },
    onError: () => setError("No pudimos guardar los cambios."),
  });

  const pending = create.isPending || update.isPending;

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const common = {
          name: form.name,
          description: form.description || undefined,
          brandId: form.brandId || undefined,
          categoryId: form.categoryId || undefined,
          supplierRef: form.supplierRef || undefined,
          status: form.status,
        };
        if (isNew) {
          create.execute({ ...common, sku: form.sku, priceCents: form.price });
        } else {
          update.execute({ ...common, productId: product.id });
        }
      }}
    >
      <label>
        <span className={labelClass}>Nombre</span>
        <Input
          required
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Tal como lo nombra el fabricante"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Marca</span>
          <Select
            value={form.brandId}
            onChange={(e) => set("brandId", e.target.value)}
          >
            <option value="">Sin marca</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className={labelClass}>Categoría</span>
          <Select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Referencia del proveedor</span>
          <Input
            value={form.supplierRef}
            onChange={(e) => set("supplierRef", e.target.value)}
            placeholder="REF: 11362"
          />
        </label>
        <label>
          <span className={labelClass}>Estado</span>
          <Select
            value={form.status}
            onChange={(e) => set("status", e.target.value as ProductStatus)}
          >
            <option value="DRAFT">Borrador</option>
            <option value="ACTIVE">Publicado</option>
            <option value="ARCHIVED">Archivado</option>
          </Select>
        </label>
      </div>

      {isNew ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>SKU</span>
            <Input
              required
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="LOV-LUSH3"
            />
          </label>
          <label>
            <span className={labelClass}>Precio</span>
            <Input
              required
              inputMode="numeric"
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
              placeholder="120.000"
            />
          </label>
        </div>
      ) : null}

      <label>
        <span className={labelClass}>Descripción</span>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={5}
          placeholder="Material, medidas, función, cuidado y compatibilidad — clínico, sin eufemismos."
          className="w-full rounded-[4px] border border-linea bg-crema px-3 py-2 text-[15px] font-light outline-none transition-colors duration-150 focus:border-vino"
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-exito">
          Guardado.
        </p>
      ) : null}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : isNew ? "Crear producto" : "Guardar"}
        </Button>
      </div>
    </form>
  );
}
