"use client";

import { useAction } from "next-safe-action/hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCOP } from "@/lib/money";
import { publishStagedProduct, type PublishResult } from "../actions";
import { CATEGORIES, type CategorySlug, type Supplier } from "../config";
import { computeSalePriceCents, DEFAULT_PRICING } from "../pricing";

const labelClass = "mb-2 block text-sm font-medium text-cuerpo";

const ERROR_MESSAGE: Record<string, string> = {
  NOT_FOUND: "Este producto ya no está en el staging.",
  PAYLOAD_INVALID:
    "Los datos del proveedor no pasan la validación — reintenta después de refrescar el staging.",
  CLOUDINARY_MISSING:
    "Falta la credencial de Cloudinary en este entorno; sin ella no se pueden rehospedar las fotos.",
  PUBLISH_FAILED: "No pudimos publicar. Intenta de nuevo.",
};

type Props = {
  stagingId: string;
  supplier: Supplier;
  /** Minimum supplier price — the margin preview's base. */
  supplierPriceCents: number;
  priceVariesByVariant: boolean;
  suggestedCategorySlug: CategorySlug | null;
  detectedBrand: string | null;
  alreadyPublished: boolean;
};

export function PublishPanel({
  stagingId,
  supplier,
  supplierPriceCents,
  priceVariesByVariant,
  suggestedCategorySlug,
  detectedBrand,
  alreadyPublished,
}: Props) {
  const router = useRouter();

  const [categorySlug, setCategorySlug] = useState<string>(
    suggestedCategorySlug ?? "",
  );
  const [brand, setBrand] = useState(detectedBrand ?? "");
  const [mode, setMode] = useState<"margen" | "manual">("margen");
  const [marginPct, setMarginPct] = useState(
    String(DEFAULT_PRICING.marginPct[supplier]),
  );
  const [salePrice, setSalePrice] = useState("");
  const [initialStock, setInitialStock] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<PublishResult, { ok: true }> | null>(
    null,
  );

  const marginPreviewCents = useMemo(() => {
    const pct = Number(marginPct);
    if (!Number.isFinite(pct) || pct < 0) return null;
    return computeSalePriceCents(
      supplierPriceCents,
      pct,
      DEFAULT_PRICING.roundUpToCOP,
    );
  }, [marginPct, supplierPriceCents]);

  const publish = useAction(publishStagedProduct, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.ok) {
        setDone(data);
        router.refresh();
      } else {
        setError(ERROR_MESSAGE[data.code] ?? ERROR_MESSAGE.PUBLISH_FAILED);
      }
    },
    onError: () => setError(ERROR_MESSAGE.PUBLISH_FAILED),
  });

  if (done) {
    return (
      <div className="grid gap-3 rounded-[4px] border border-linea bg-crema p-5">
        <p className="text-sm text-exito" role="status">
          {done.action === "created" ? "Publicado" : "Actualizado"} — desde{" "}
          {formatCOP(done.minPriceCents)}.
        </p>
        {done.warnings.length > 0 ? (
          <ul className="grid gap-1">
            {done.warnings.map((w) => (
              <li key={w} className="text-[13px] font-light text-suave">
                {w}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/admin/productos/${done.productId}`}
            className="text-[13px] font-medium tracking-boton text-cobre uppercase transition-colors duration-150 hover:text-vino"
          >
            Abrir en productos →
          </Link>
          <Link
            href={`/tienda/${done.slug}`}
            className="text-[13px] font-medium tracking-boton text-cobre uppercase transition-colors duration-150 hover:text-vino"
          >
            Ver en la tienda →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      className="grid gap-4 rounded-[4px] border border-linea bg-crema p-5"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        publish.execute({
          stagingId,
          categorySlug: categorySlug as CategorySlug,
          brand: brand || undefined,
          pricingMode: mode,
          salePriceCOP: mode === "manual" ? salePrice : undefined,
          marginPct: mode === "margen" ? Number(marginPct) : undefined,
          initialStock: Number(initialStock) || 0,
        });
      }}
    >
      <h2 className="text-[12px] font-medium tracking-kicker text-cobre uppercase">
        {alreadyPublished ? "Actualizar en la tienda" : "Publicar en la tienda"}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Categoría</span>
          <Select
            required
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
          >
            <option value="" disabled>
              Elige una
            </option>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className={labelClass}>Marca</span>
          <Input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Sin marca"
          />
        </label>
      </div>

      <fieldset className="grid gap-3">
        <legend className={labelClass}>Precio de venta</legend>
        <p className="text-[13px] font-light text-tenue">
          El precio del proveedor es una referencia, nunca el precio de venta.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label
            className={`grid gap-2 rounded-[4px] border p-3 transition-colors duration-150 ${
              mode === "margen" ? "border-vino bg-marfil" : "border-linea"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-cuerpo">
              <input
                type="radio"
                name="pricingMode"
                checked={mode === "margen"}
                onChange={() => setMode("margen")}
              />
              Margen sobre el proveedor
            </span>
            <span className="flex items-center gap-2">
              <Input
                inputMode="numeric"
                value={marginPct}
                onChange={(e) => setMarginPct(e.target.value)}
                disabled={mode !== "margen"}
                aria-label="Margen en porcentaje"
                className="w-24"
              />
              <span className="text-sm font-light text-suave">%</span>
            </span>
            <span className="text-[13px] font-light text-tenue tabular-nums">
              {marginPreviewCents !== null
                ? `Queda desde ${formatCOP(marginPreviewCents)}`
                : "Margen inválido"}
              {priceVariesByVariant
                ? " · cada variante conserva su diferencia"
                : ""}
            </span>
          </label>

          <label
            className={`grid gap-2 rounded-[4px] border p-3 transition-colors duration-150 ${
              mode === "manual" ? "border-vino bg-marfil" : "border-linea"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-cuerpo">
              <input
                type="radio"
                name="pricingMode"
                checked={mode === "manual"}
                onChange={() => setMode("manual")}
              />
              Precio manual
            </span>
            <Input
              inputMode="numeric"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              disabled={mode !== "manual"}
              placeholder="120.000"
              aria-label="Precio de venta en pesos"
            />
            <span className="text-[13px] font-light text-tenue">
              {priceVariesByVariant
                ? "Ojo: todas las variantes quedan con este mismo precio"
                : "Un solo precio para el producto"}
            </span>
          </label>
        </div>
      </fieldset>

      <label className="sm:max-w-56">
        <span className={labelClass}>Stock inicial por variante</span>
        <Input
          inputMode="numeric"
          value={initialStock}
          onChange={(e) => setInitialStock(e.target.value)}
        />
        <span className="mt-1 block text-[13px] font-light text-tenue">
          Cero está bien: las unidades entran después con el ajuste de stock.
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={publish.isPending || !categorySlug}>
          {publish.isPending
            ? "Publicando…"
            : alreadyPublished
              ? "Actualizar"
              : "Publicar"}
        </Button>
        {publish.isPending ? (
          <span role="status" className="text-sm font-light text-suave">
            Bajando y rehospedando las fotos — puede tardar un momento.
          </span>
        ) : null}
      </div>
    </form>
  );
}
