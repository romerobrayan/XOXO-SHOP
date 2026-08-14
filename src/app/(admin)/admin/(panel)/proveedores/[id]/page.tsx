import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { PublishPanel } from "@/features/import/components/PublishPanel";
import { getStagedProduct } from "@/features/import/queries";
import { formatCOP } from "@/lib/money";

export const metadata: Metadata = {
  title: "Curar producto",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
// Publishing downloads up to 8 supplier photos and re-hosts them on
// Cloudinary (plus per-variation price fetches for Woo) — well past the
// default function budget, comfortably inside this one.
export const maxDuration = 60;

const SUPPLIER_LABEL: Record<string, string> = {
  distrisex: "DistriSex",
  climax: "Climax",
};

export default async function CurarProductoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getStagedProduct(id);
  if (!item) notFound();

  const staged = item.staged;

  return (
    <section className="grid gap-6">
      <div>
        <Link
          href="/admin/proveedores"
          className="text-[13px] font-medium tracking-boton text-cuerpo uppercase transition-colors duration-150 hover:text-vino"
        >
          ← Proveedores
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-[family-name:--font-display] text-[32px]">
            {item.name}
          </h1>
          {item.status === "PUBLISHED" ? (
            <Badge variant="exito">Publicado</Badge>
          ) : (
            <Badge>Pendiente</Badge>
          )}
        </div>
        <p className="mt-1 text-sm font-light text-suave">
          {SUPPLIER_LABEL[item.supplier] ?? item.supplier}
          {item.brand ? ` · marca detectada: ${item.brand}` : " · sin marca detectada"}
          {" · "}
          <a
            href={staged?.supplierUrl ?? "#"}
            target="_blank"
            rel="noreferrer noopener"
            className="text-cobre transition-colors duration-150 hover:text-vino"
          >
            ficha del proveedor →
          </a>
        </p>
      </div>

      {item.status === "PUBLISHED" && item.publishedProduct ? (
        <p className="rounded-[4px] border border-linea bg-arena p-4 text-sm font-light text-cuerpo">
          Ya está en tu catálogo como{" "}
          <Link
            href={`/admin/productos/${item.publishedProduct.id}`}
            className="font-medium text-vino underline-offset-2 hover:underline"
          >
            {item.publishedProduct.name}
          </Link>
          . Volver a publicar refresca nombre, descripción y fotos del
          proveedor; tu precio y tu stock no se tocan.
        </p>
      ) : null}

      {!staged ? (
        <p role="alert" className="rounded-[4px] border border-error/40 bg-crema p-4 text-sm text-error">
          Los datos guardados de este producto no pasan la validación
          ({item.payloadError}). Refresca el staging con los comandos de
          importación y vuelve a intentarlo.
        </p>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="grid content-start gap-4">
              {staged.images.length > 0 ? (
                <ul className="grid grid-cols-3 gap-2">
                  {staged.images.slice(0, 6).map((img) => (
                    <li
                      key={img.url}
                      className="overflow-hidden rounded-[4px] border border-linea bg-arena"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.url}
                        alt={item.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="aspect-[4/5] w-full object-contain"
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-[4px] border border-linea bg-crema p-4 text-sm font-light text-suave">
                  El proveedor no publica fotos de este producto.
                </p>
              )}
              <p className="text-[13px] font-light text-tenue">
                {staged.images.length} foto{staged.images.length === 1 ? "" : "s"}{" "}
                del proveedor — al publicar se rehospedan en Cloudinary con el
                encuadre 4:5 de la marca (máximo 8).
              </p>

              <div className="rounded-[4px] border border-linea bg-crema p-4">
                <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
                  Referencia de precio
                </h2>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="font-light text-suave">
                      Precio del proveedor{" "}
                      {staged.priceVariesByVariant ? "(desde)" : ""}
                    </dt>
                    <dd className="font-semibold text-vino tabular-nums">
                      {formatCOP(item.supplierPriceCents)}
                    </dd>
                  </div>
                  {staged.suggestedRetailCents ? (
                    <div className="flex justify-between gap-3">
                      <dt className="font-light text-suave">
                        Sugerido por el mayorista
                      </dt>
                      <dd className="font-light tabular-nums">
                        {formatCOP(staged.suggestedRetailCents)}
                      </dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3">
                    <dt className="font-light text-suave">
                      Disponibilidad allá
                    </dt>
                    <dd className="font-light">
                      {item.available ? "Con stock" : "Agotado ahora"}
                    </dd>
                  </div>
                </dl>
              </div>

              {staged.variants.length > 1 || staged.options.length > 0 ? (
                <div className="rounded-[4px] border border-linea bg-crema p-4">
                  <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
                    Variantes del proveedor ({staged.variants.length})
                  </h2>
                  <ul className="grid gap-2">
                    {staged.variants.map((v) => (
                      <li
                        key={v.supplierVariantId}
                        className="flex flex-wrap items-center justify-between gap-2 border-b border-linea pb-2 text-sm last:border-b-0 last:pb-0"
                      >
                        <span className="font-light">
                          {Object.values(v.options).join(" / ") || "Única"}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-light text-tenue tabular-nums">
                            {v.supplierPriceCents > 0
                              ? formatCOP(v.supplierPriceCents)
                              : "precio al publicar"}
                          </span>
                          {!v.available ? (
                            <Badge variant="error">Agotado</Badge>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {staged.priceVariesByVariant ? (
                    <p className="mt-2 text-[13px] font-light text-tenue">
                      Este producto tiene precios distintos por variante — el
                      detalle exacto se consulta al proveedor al publicar.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {staged.specs.length > 0 ? (
                <div className="rounded-[4px] border border-linea bg-crema p-4">
                  <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
                    Ficha técnica
                  </h2>
                  <dl className="grid gap-1 text-sm">
                    {staged.specs.map((s) => (
                      <div key={s.label} className="flex justify-between gap-3">
                        <dt className="font-light text-suave">{s.label}</dt>
                        <dd className="text-right font-light">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
            </div>

            <div className="grid content-start gap-4">
              <PublishPanel
                stagingId={item.id}
                supplier={staged.supplier}
                supplierPriceCents={item.supplierPriceCents}
                priceVariesByVariant={staged.priceVariesByVariant}
                suggestedCategorySlug={staged.suggestedCategorySlug}
                detectedBrand={item.brand}
                alreadyPublished={item.status === "PUBLISHED"}
              />

              {staged.descriptionText ? (
                <div className="rounded-[4px] border border-linea bg-crema p-4">
                  <h2 className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
                    Descripción del proveedor
                  </h2>
                  <p className="text-sm font-light whitespace-pre-line text-cuerpo">
                    {staged.descriptionText}
                  </p>
                  <p className="mt-3 text-[13px] font-light text-tenue">
                    Se publica tal cual; el tono clínico de la marca (material,
                    medidas, función, cuidado) se ajusta después desde
                    Productos.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
