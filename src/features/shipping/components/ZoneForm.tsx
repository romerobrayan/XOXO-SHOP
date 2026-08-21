"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DEPARTAMENTOS } from "@/features/checkout/schemas";
import { createShippingZone, updateShippingZone } from "../actions";
import type { ShippingZoneKindInput } from "../schemas";
import type { AdminShippingZone } from "../queries";

const labelClass = "mb-2 block text-sm font-medium text-cuerpo";
const hintClass = "mt-1 text-xs text-cobre";

// next-safe-action's default ("formatted") validationErrors shape is one
// level deep per field: { fieldName: { _errors: string[] }, ... }.
function firstValidationError(validationErrors: unknown): string | null {
  if (!validationErrors || typeof validationErrors !== "object") return null;
  for (const value of Object.values(
    validationErrors as Record<string, unknown>,
  )) {
    if (value && typeof value === "object" && "_errors" in value) {
      const errors = (value as { _errors?: string[] })._errors;
      if (errors && errors.length > 0) return errors[0];
    }
  }
  return null;
}

const KINDS: [ShippingZoneKindInput, string, string][] = [
  [
    "SPECIFIC",
    "Ubicaciones específicas",
    "Los barrios o municipios que escribas abajo pagan esta tarifa.",
  ],
  [
    "GENERAL",
    "Domicilio general del departamento",
    "Todo lo que no calce en una zona específica de ese departamento.",
  ],
  [
    "NATIONAL",
    "Domicilio nacional",
    "El resto del país. Sin él, una dirección fuera de tus zonas queda sin tarifa y se coordina por WhatsApp.",
  ],
];

// Pesos as typed, no separators forced: the schema parses "12.000" and
// "12000" the same way.
const centsToInput = (cents: number) => String(Math.round(cents / 100));

export function ZoneForm({ zone }: { zone?: AdminShippingZone }) {
  const router = useRouter();
  const isNew = !zone;

  const [form, setForm] = useState({
    name: zone?.name ?? "",
    kind: (zone?.kind ?? "SPECIFIC") as ShippingZoneKindInput,
    department: zone?.department ?? "Antioquia",
    price: zone ? centsToInput(zone.priceCents) : "",
    note: zone?.note ?? "",
    areas: zone?.areas.join(", ") ?? "",
    isActive: zone?.isActive ?? true,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onResult = (data: unknown) => {
    const result = data as
      | { ok: true; zoneId: string }
      | { ok: false; code: "AREA_TAKEN"; areas: string[] }
      | { ok: false; code: "KIND_TAKEN"; name: string }
      | undefined;
    if (!result) return;
    if (result.ok) {
      if (isNew) {
        router.push("/admin/domicilios");
        return;
      }
      setSaved(true);
      router.refresh();
      return;
    }
    setError(
      result.code === "AREA_TAKEN"
        ? `Ya tienes otra zona que cubre ${result.areas.join(", ")}. Quítalo de allá o de aquí: una ubicación no puede tener dos precios.`
        : `Ya existe "${result.name}" para eso. Edita esa zona en vez de crear otra.`,
    );
  };

  const create = useAction(createShippingZone, {
    onSuccess: ({ data }) => onResult(data),
    onError: ({ error }) =>
      setError(
        firstValidationError(error.validationErrors) ??
          "No pudimos crear la zona.",
      ),
  });
  const update = useAction(updateShippingZone, {
    onSuccess: ({ data }) => onResult(data),
    onError: ({ error }) =>
      setError(
        firstValidationError(error.validationErrors) ??
          "No pudimos guardar los cambios.",
      ),
  });
  const pending = create.isPending || update.isPending;

  const usesDepartment = form.kind !== "NATIONAL";
  const usesAreas = form.kind === "SPECIFIC";
  const kindHint = KINDS.find(([value]) => value === form.kind)![2];

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSaved(false);
        const common = {
          name: form.name,
          kind: form.kind,
          department: usesDepartment
            ? (form.department as (typeof DEPARTAMENTOS)[number])
            : undefined,
          priceCents: form.price,
          note: form.note || undefined,
          areas: usesAreas ? form.areas : "",
          isActive: form.isActive,
        };
        if (isNew) create.execute(common);
        else update.execute({ ...common, zoneId: zone.id });
      }}
    >
      <label>
        <span className={labelClass}>Nombre de la zona</span>
        <Input
          required
          maxLength={60}
          placeholder="Ej: El Poblado y Laureles"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <p className={hintClass}>
          Lo ve la compradora en el checkout y en la página de envíos.
        </p>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className={labelClass}>Tipo</span>
          <Select
            value={form.kind}
            onChange={(e) =>
              set("kind", e.target.value as ShippingZoneKindInput)
            }
          >
            {KINDS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <p className={hintClass}>{kindHint}</p>
        </label>
        <label>
          <span className={labelClass}>Precio del domicilio</span>
          <Input
            required
            inputMode="numeric"
            placeholder="12.000"
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
          <p className={hintClass}>
            En pesos. Escribe 0 si el domicilio es gratis en esta zona.
          </p>
        </label>
      </div>

      {usesDepartment && (
        <label>
          <span className={labelClass}>Departamento</span>
          <Select
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
          >
            {DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </label>
      )}

      {usesAreas && (
        <label>
          <span className={labelClass}>Ubicaciones que cubre</span>
          <textarea
            rows={4}
            placeholder="El Poblado, Laureles, Envigado, Sabaneta"
            value={form.areas}
            onChange={(e) => set("areas", e.target.value)}
            className="w-full rounded-[4px] border border-linea bg-crema px-3 py-2 text-[15px] text-tinta outline-none placeholder:text-tenue focus:border-vino"
          />
          <p className={hintClass}>
            Barrios o municipios, separados por comas o uno por línea. No
            importan tildes ni mayúsculas: &ldquo;El Poblado&rdquo; y
            &ldquo;poblado&rdquo; son lo mismo.
          </p>
        </label>
      )}

      <label>
        <span className={labelClass}>
          Nota para la compradora{" "}
          <span className="font-light text-tenue">(opcional)</span>
        </span>
        <Input
          maxLength={120}
          placeholder="Ej: entrega el mismo día si pides antes de las 2 p.m."
          value={form.note}
          onChange={(e) => set("note", e.target.value)}
        />
      </label>

      <label className="flex items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="accent-vino"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
        Zona activa (se cobra en el checkout y aparece en la página de envíos)
      </label>

      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-exito">Cambios guardados.</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : isNew ? "Crear zona" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
