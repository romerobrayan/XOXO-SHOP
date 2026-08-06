"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCOP } from "@/lib/money";
import { adjustStock, generateVariants, updateVariant } from "../actions";
import type { AdjustReason } from "../schemas";

type Variant = {
  id: string;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stockOnHand: number;
  stockReserved: number;
  lowStockAt: number;
  isActive: boolean;
  optionValues: {
    optionValue: { id: string; value: string; option: { name: string } };
  }[];
};

export function VariantsTable({
  productId,
  hasOptionValues,
  variants,
}: {
  productId: string;
  hasOptionValues: boolean;
  variants: Variant[];
}) {
  const router = useRouter();
  const [genPrice, setGenPrice] = useState("");
  const [genMessage, setGenMessage] = useState<string | null>(null);

  const generate = useAction(generateVariants, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.ok) {
        setGenMessage(
          data.created === 0
            ? "Todas las combinaciones ya existen."
            : `${data.created} variante${data.created === 1 ? "" : "s"} nueva${data.created === 1 ? "" : "s"}.`,
        );
        router.refresh();
      } else {
        setGenMessage("Agrega opciones con valores antes de generar.");
      }
    },
    onError: () => setGenMessage("No pudimos generar las variantes."),
  });

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {variants.map((variant) => (
          <VariantRow key={variant.id} variant={variant} />
        ))}
      </ul>

      {hasOptionValues ? (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-linea pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            setGenMessage(null);
            generate.execute({ productId, priceCents: genPrice });
          }}
        >
          <label className="grow sm:max-w-48">
            <span className="mb-2 block text-sm font-medium text-cuerpo">
              Precio para las nuevas
            </span>
            <Input
              required
              inputMode="numeric"
              value={genPrice}
              onChange={(e) => setGenPrice(e.target.value)}
              placeholder="120.000"
            />
          </label>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={generate.isPending}
          >
            Generar combinaciones
          </Button>
          {genMessage ? (
            <span role="status" className="text-sm font-light text-suave">
              {genMessage}
            </span>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function VariantRow({ variant }: { variant: Variant }) {
  const router = useRouter();
  const available = variant.stockOnHand - variant.stockReserved;
  const label = variant.optionValues
    .map((ov) => ov.optionValue.value)
    .join(" / ");

  const [editing, setEditing] = useState(false);
  const [sku, setSku] = useState(variant.sku);
  const [price, setPrice] = useState(String(variant.priceCents / 100));
  const [message, setMessage] = useState<string | null>(null);

  const save = useAction(updateVariant, {
    onSuccess({ data }) {
      if (data && "ok" in data && data.ok) {
        setEditing(false);
        setMessage(null);
        router.refresh();
      } else {
        setMessage("Ese SKU pertenece a otra variante.");
      }
    },
    onError: () => setMessage("No pudimos guardar la variante."),
  });

  const toggle = useAction(updateVariant, {
    onSuccess: () => router.refresh(),
  });

  return (
    <li
      className={`grid gap-3 rounded-[4px] border border-linea p-4 ${
        variant.isActive ? "bg-crema" : "bg-arena opacity-70"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <span className="font-medium tabular-nums">{variant.sku}</span>
          <span className="text-sm font-light text-suave">
            {label || "Única"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-vino tabular-nums">
            {formatCOP(variant.priceCents)}
          </span>
          {available <= 0 ? (
            <Badge variant="error">Agotado</Badge>
          ) : available <= variant.lowStockAt ? (
            <Badge variant="oro">Quedan {available}</Badge>
          ) : (
            <Badge variant="exito">{available} disp.</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-3">
        <StockStepper
          variantId={variant.id}
          stockOnHand={variant.stockOnHand}
          stockReserved={variant.stockReserved}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing((e) => !e);
              setMessage(null);
            }}
          >
            {editing ? "Cerrar" : "Editar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={toggle.isPending}
            onClick={() =>
              toggle.execute({
                variantId: variant.id,
                sku: variant.sku,
                priceCents: String(variant.priceCents / 100),
                isActive: !variant.isActive,
              })
            }
          >
            {variant.isActive ? "Desactivar" : "Activar"}
          </Button>
        </div>
      </div>

      {editing ? (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-linea pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.execute({
              variantId: variant.id,
              sku,
              priceCents: price,
              isActive: variant.isActive,
            });
          }}
        >
          <label className="grow sm:max-w-52">
            <span className="mb-2 block text-sm font-medium text-cuerpo">
              SKU
            </span>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </label>
          <label className="grow sm:max-w-40">
            <span className="mb-2 block text-sm font-medium text-cuerpo">
              Precio
            </span>
            <Input
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <Button type="submit" size="sm" disabled={save.isPending}>
            Guardar
          </Button>
        </form>
      ) : null}

      {message ? (
        <p role="alert" className="text-sm text-error">
          {message}
        </p>
      ) : null}
    </li>
  );
}

// The two-tap adjustment: tap − or + until the number is right, tap
// "Aplicar". The reason follows the sign by default (units usually arrive
// because they were bought, and leave because a count found fewer), and every
// application writes exactly one ledger row.
function StockStepper({
  variantId,
  stockOnHand,
  stockReserved,
}: {
  variantId: string;
  stockOnHand: number;
  stockReserved: number;
}) {
  const router = useRouter();
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState<AdjustReason | "">("");
  const [message, setMessage] = useState<string | null>(null);

  // The reason follows the sign; a reason picked before the sign flipped
  // (tapped − into +) would fail the schema's direction check, so it falls
  // back instead of sticking.
  const signValid =
    reason === "MANUAL_ADJUST" ||
    (reason === "PURCHASE" && delta > 0) ||
    (reason === "DAMAGE" && delta < 0);
  const effectiveReason: AdjustReason = signValid
    ? (reason as AdjustReason)
    : delta > 0
      ? "PURCHASE"
      : "MANUAL_ADJUST";

  const apply = useAction(adjustStock, {
    onSuccess({ data }) {
      if (!data) return;
      if (data.ok) {
        setDelta(0);
        setReason("");
        setMessage(null);
        router.refresh();
        return;
      }
      setMessage(
        data.code === "WOULD_BREAK_RESERVATIONS"
          ? `No puede quedar por debajo de ${stockReserved}: hay pedidos con ese stock reservado.`
          : "La variante ya no existe.",
      );
    },
    onError: () => setMessage("No pudimos ajustar el stock."),
  });

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-label="Restar una unidad"
          disabled={stockOnHand + delta - 1 < stockReserved}
          onClick={() => setDelta((d) => d - 1)}
        >
          −
        </Button>
        <span className="min-w-16 text-center tabular-nums">
          {stockOnHand}
          {delta !== 0 ? (
            <span className={delta > 0 ? "text-exito" : "text-error"}>
              {" "}
              {delta > 0 ? `+${delta}` : delta}
            </span>
          ) : null}
        </span>
        <Button
          size="icon"
          variant="outline"
          aria-label="Sumar una unidad"
          onClick={() => setDelta((d) => d + 1)}
        >
          +
        </Button>

        {delta !== 0 ? (
          <>
            <Select
              aria-label="Motivo"
              value={effectiveReason}
              onChange={(e) => setReason(e.target.value as AdjustReason)}
              className="w-auto"
            >
              {delta > 0 ? (
                <option value="PURCHASE">Llegó del proveedor</option>
              ) : (
                <option value="DAMAGE">Dañado</option>
              )}
              <option value="MANUAL_ADJUST">Conteo físico</option>
            </Select>
            <Button
              size="sm"
              disabled={apply.isPending}
              onClick={() =>
                apply.execute({ variantId, delta, reason: effectiveReason })
              }
            >
              Aplicar
            </Button>
          </>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="text-sm text-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}
