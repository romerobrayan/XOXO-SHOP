import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ZoneRowActions } from "@/features/shipping/components/ZoneRowActions";
import { getAllShippingZones } from "@/features/shipping/queries";
import { FALLBACK_SHIPPING_CENTS } from "@/features/shipping/zones";
import { formatCOP } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Domicilios",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  SPECIFIC: "Ubicaciones específicas",
  GENERAL: "Domicilio general",
  NATIONAL: "Domicilio nacional",
} as const;

export default async function DomiciliosPage() {
  const zones = await getAllShippingZones();
  const activas = zones.filter((z) => z.isActive);
  // Sin zonas cargadas el checkout sigue cobrando la tarifa plana de siempre,
  // y decirlo importa: la lista vacía no significa "envío gratis".
  const sinConfigurar = activas.length === 0;
  // Con zonas cargadas pero sin nacional, una dirección fuera de ellas se va a
  // WhatsApp. Es una decisión válida; lo que no puede ser es una sorpresa.
  const faltaNacional =
    !sinConfigurar && !activas.some((z) => z.kind === "NATIONAL");

  return (
    <section className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:--font-display] text-[32px]">
            Domicilios
          </h1>
          <p className="mt-1 text-sm font-light text-suave">
            El precio del domicilio según a dónde va el pedido. El checkout
            cobra estas tarifas y la página de envíos las publica.
          </p>
        </div>
        <Link
          href="/admin/domicilios/nuevo"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Nueva zona
        </Link>
      </div>

      {sinConfigurar && (
        <p className="rounded-[4px] border border-oro bg-arena p-4 text-sm leading-relaxed">
          Todavía no tienes zonas activas, así que el checkout cobra{" "}
          <strong>{formatCOP(FALLBACK_SHIPPING_CENTS)}</strong> a todo el país
          —la tarifa que venía por defecto—. Crea tus zonas y esa tarifa deja de
          aplicar.
        </p>
      )}

      {faltaNacional && (
        <p className="rounded-[4px] border border-error bg-crema p-4 text-sm leading-relaxed">
          Te falta un <strong>domicilio nacional</strong>. Una dirección fuera
          de tus zonas queda sin tarifa: la compradora no puede confirmar sola y
          tiene que escribirte por WhatsApp para cerrar el pedido.
        </p>
      )}

      {zones.length === 0 ? (
        <p className="rounded-[4px] border border-linea bg-crema p-6 text-sm font-light text-suave">
          Sin zonas todavía. Empieza por las de Medellín, luego el área
          metropolitana y por último el resto del país.
        </p>
      ) : (
        <ul className="grid gap-2">
          {zones.map((zone) => (
            <li
              key={zone.id}
              className="grid gap-2 rounded-[4px] border border-linea bg-crema p-4 transition-shadow duration-150 hover:shadow-card sm:grid-cols-[1fr_auto_auto] sm:items-center"
            >
              <Link
                href={`/admin/domicilios/${zone.id}`}
                className="grid gap-1"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{zone.name}</span>
                  <Badge>{KIND_LABEL[zone.kind]}</Badge>
                  {zone.isActive ? (
                    <Badge variant="exito">Activa</Badge>
                  ) : (
                    <Badge variant="error">Pausada</Badge>
                  )}
                </div>
                <span className="text-sm font-light text-suave">
                  {zone.kind === "NATIONAL"
                    ? "Todo el país"
                    : zone.areas.length > 0
                      ? `${zone.department} · ${zone.areas.join(", ")}`
                      : `${zone.department} · todo lo que no calce en otra zona`}
                </span>
              </Link>
              <span className="font-semibold text-vino tabular-nums sm:justify-self-end">
                {formatCOP(zone.priceCents)}
              </span>
              <div className="justify-self-start sm:justify-self-end">
                <ZoneRowActions
                  zoneId={zone.id}
                  name={zone.name}
                  isActive={zone.isActive}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
