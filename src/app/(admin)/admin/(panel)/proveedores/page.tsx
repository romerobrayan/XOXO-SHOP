import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CATEGORIES } from "@/features/import/config";
import {
  listStagedProducts,
  stagingStatusCounts,
  type StagingListFilters,
} from "@/features/import/queries";
import { formatCOP } from "@/lib/money";

export const metadata: Metadata = {
  title: "Proveedores",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SUPPLIER_LABEL: Record<string, string> = {
  distrisex: "DistriSex",
  climax: "Climax",
};

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = firstParam(sp.q)?.trim() || undefined;
  const supplierParam = firstParam(sp.proveedor);
  const categoriaParam = firstParam(sp.categoria);
  const estadoParam = firstParam(sp.estado);
  const pageParam = Number(firstParam(sp.pagina) ?? "1");

  const filters: StagingListFilters = {
    q,
    supplier:
      supplierParam === "distrisex" || supplierParam === "climax"
        ? supplierParam
        : undefined,
    categoria:
      categoriaParam === "sin-categoria" ||
      CATEGORIES.some((c) => c.slug === categoriaParam)
        ? (categoriaParam as StagingListFilters["categoria"])
        : undefined,
    estado:
      estadoParam === "publicados" || estadoParam === "todos"
        ? estadoParam
        : "pendientes",
    page: Number.isFinite(pageParam) && pageParam >= 1 ? Math.floor(pageParam) : 1,
  };

  const [{ items, total, page, pageCount }, counts] = await Promise.all([
    listStagedProducts(filters),
    stagingStatusCounts(),
  ]);

  const baseQuery = new URLSearchParams();
  if (q) baseQuery.set("q", q);
  if (filters.supplier) baseQuery.set("proveedor", filters.supplier);
  if (filters.categoria) baseQuery.set("categoria", filters.categoria);
  baseQuery.set("estado", filters.estado);
  const pageHref = (target: number) => {
    const params = new URLSearchParams(baseQuery);
    params.set("pagina", String(target));
    return `/admin/proveedores?${params.toString()}`;
  };

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="font-[family-name:--font-display] text-[32px]">
          Proveedores
        </h1>
        <p className="mt-1 text-sm font-light text-suave">
          El catálogo completo de los dos proveedores ({counts.total}). Elige un
          producto, pon tu precio y publícalo — quedan {counts.pendientes} por
          revisar.
        </p>
      </div>

      {counts.total === 0 ? (
        <p className="rounded-[4px] border border-linea bg-crema p-6 text-sm font-light text-suave">
          El staging está vacío en esta base. Se carga con{" "}
          <code className="font-mono text-[13px]">npm run import:stage</code>{" "}
          después de bajar los proveedores (docs/IMPORT-PROVEEDORES.md).
        </p>
      ) : (
        <>
          <form
            method="get"
            action="/admin/proveedores"
            className="grid gap-3 rounded-[4px] border border-linea bg-crema p-4 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end"
          >
            <label className="grid gap-2">
              <span className="text-sm font-medium text-cuerpo">Buscar</span>
              <Input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Nombre, marca o categoría del proveedor"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-cuerpo">Proveedor</span>
              <Select name="proveedor" defaultValue={filters.supplier ?? ""}>
                <option value="">Todos</option>
                <option value="distrisex">DistriSex</option>
                <option value="climax">Climax</option>
              </Select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-cuerpo">Categoría</span>
              <Select name="categoria" defaultValue={filters.categoria ?? ""}>
                <option value="">Todas</option>
                {CATEGORIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
                <option value="sin-categoria">Sin sugerencia</option>
              </Select>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-cuerpo">Estado</span>
              <Select name="estado" defaultValue={filters.estado}>
                <option value="pendientes">
                  Pendientes ({counts.pendientes})
                </option>
                <option value="publicados">
                  Publicados ({counts.publicados})
                </option>
                <option value="todos">Todos ({counts.total})</option>
              </Select>
            </label>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>

          <p className="text-[13px] font-light text-tenue">
            {total} resultado{total === 1 ? "" : "s"} · las fotos de esta
            pantalla vienen del proveedor y son solo para curaduría — al
            publicar se rehospedan con el encuadre de la marca.
          </p>

          {items.length === 0 ? (
            <p className="rounded-[4px] border border-linea bg-crema p-6 text-sm font-light text-suave">
              Nada coincide con ese filtro.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/proveedores/${item.id}`}
                    className="grid h-full content-start gap-2 rounded-[4px] border border-linea bg-crema p-3 transition-shadow duration-150 hover:shadow-card"
                  >
                    <div className="relative overflow-hidden rounded-[4px] border border-linea bg-arena">
                      {item.previewImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewImageUrl}
                          alt={item.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="aspect-[4/5] w-full object-contain"
                        />
                      ) : (
                        <div className="grid aspect-[4/5] w-full place-items-center">
                          <span className="font-mono text-[11px] text-tenue">
                            Sin foto
                          </span>
                        </div>
                      )}
                      {item.status === "PUBLISHED" ? (
                        <span className="absolute top-2 left-2">
                          <Badge variant="exito">Publicado</Badge>
                        </span>
                      ) : null}
                    </div>
                    <span className="line-clamp-2 min-h-[2.6em] text-sm font-medium">
                      {item.name}
                    </span>
                    <span className="text-[13px] font-light text-suave">
                      {SUPPLIER_LABEL[item.supplier] ?? item.supplier}
                      {item.brand ? ` · ${item.brand}` : ""}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-light text-tenue tabular-nums">
                        Ref. {formatCOP(item.supplierPriceCents)}
                        {item.priceVariesByVariant ? " (varía)" : ""}
                      </span>
                      {!item.available ? (
                        <Badge variant="error">Agotado allá</Badge>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {pageCount > 1 ? (
            <nav
              aria-label="Paginación"
              className="flex items-center justify-between gap-3"
            >
              {page > 1 ? (
                <Link
                  href={pageHref(page - 1)}
                  className="text-[13px] font-medium tracking-boton text-cuerpo uppercase transition-colors duration-150 hover:text-vino"
                >
                  ← Anterior
                </Link>
              ) : (
                <span />
              )}
              <span className="text-[13px] font-light text-tenue tabular-nums">
                Página {page} de {pageCount}
              </span>
              {page < pageCount ? (
                <Link
                  href={pageHref(page + 1)}
                  className="text-[13px] font-medium tracking-boton text-cuerpo uppercase transition-colors duration-150 hover:text-vino"
                >
                  Siguiente →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
