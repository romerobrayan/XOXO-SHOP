"use client";

import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addOption, addOptionValue } from "../actions";

type Option = {
  id: string;
  name: string;
  values: { id: string; value: string; hex: string | null }[];
};

// Options and values only grow from here. Removing one would orphan the
// variants built on it, and those carry ledger history — deactivating the
// variant is the reversible move, and it lives in the variants table.
export function OptionsEditor({
  productId,
  options,
}: {
  productId: string;
  options: Option[];
}) {
  const router = useRouter();
  const [optionName, setOptionName] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const add = useAction(addOption, {
    onSuccess({ data }) {
      if (data && "ok" in data && data.ok) {
        setOptionName("");
        setMessage(null);
        router.refresh();
      } else {
        setMessage("Esa opción ya existe en este producto.");
      }
    },
    onError: () => setMessage("No pudimos agregar la opción."),
  });

  return (
    <div className="grid gap-4">
      {options.length === 0 ? (
        <p className="text-sm font-light text-suave">
          Sin opciones: este producto tiene una sola variante. Agrega una
          opción (Talla, Color, Presentación) solo si elegirla cambia el SKU
          que se despacha.
        </p>
      ) : (
        options.map((option) => (
          <OptionRow key={option.id} option={option} />
        ))
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!optionName.trim()) return;
          add.execute({ productId, name: optionName.trim() });
        }}
      >
        <label className="grow sm:max-w-60">
          <span className="mb-2 block text-sm font-medium text-cuerpo">
            Nueva opción
          </span>
          <Input
            value={optionName}
            onChange={(e) => setOptionName(e.target.value)}
            placeholder="Talla · Color · Presentación"
          />
        </label>
        <Button type="submit" size="sm" variant="outline" disabled={add.isPending}>
          Agregar opción
        </Button>
      </form>

      {message ? (
        <p role="alert" className="text-sm text-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function OptionRow({ option }: { option: Option }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [hex, setHex] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const isColor = /color/i.test(option.name);

  const add = useAction(addOptionValue, {
    onSuccess({ data }) {
      if (data && "ok" in data && data.ok) {
        setValue("");
        setHex("");
        setMessage(null);
        router.refresh();
      } else {
        setMessage("Ese valor ya existe.");
      }
    },
    onError: () => setMessage("No pudimos agregar el valor."),
  });

  return (
    <div className="rounded-[4px] border border-linea p-4">
      <p className="mb-3 text-[12px] font-medium tracking-kicker text-cobre uppercase">
        {option.name}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {option.values.length === 0 ? (
          <span className="text-sm font-light text-tenue">
            Todavía sin valores.
          </span>
        ) : (
          option.values.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-2 rounded-full border border-linea bg-crema px-3 py-[5px] text-[11px] tracking-[1px] uppercase"
            >
              {v.hex ? (
                <span
                  aria-hidden
                  className="size-3 rounded-full border border-linea"
                  style={{ backgroundColor: v.hex }}
                />
              ) : null}
              {v.value}
            </span>
          ))
        )}
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!value.trim()) return;
          add.execute({
            optionId: option.id,
            value: value.trim(),
            hex: isColor && hex ? hex : undefined,
          });
        }}
      >
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isColor ? "Negro" : "S · 30 ml"}
          className="w-40"
        />
        {isColor ? (
          <input
            type="color"
            aria-label="Color"
            value={hex || "#2b1b20"}
            onChange={(e) => setHex(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-[4px] border border-linea bg-crema"
          />
        ) : null}
        <Button type="submit" size="sm" variant="ghost" disabled={add.isPending}>
          Agregar valor
        </Button>
      </form>

      {message ? (
        <p role="alert" className="mt-2 text-sm text-error">
          {message}
        </p>
      ) : null}
    </div>
  );
}
