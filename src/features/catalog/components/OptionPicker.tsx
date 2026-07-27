"use client";

import { useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  valueAvailability,
  type PickerOption,
  type PickerVariant,
  type Selection,
} from "../pickerState";

// Three states, one component: two axes render two groups, one axis renders
// one, zero axes render NOTHING — the section does not exist in the DOM, so a
// single-SKU product looks intentional, not broken.
//
// Semantics: each axis is a radiogroup of role="radio" buttons with a custom
// roving tabindex. Radix RadioGroup is deliberately not used here — it skips
// disabled items in keyboard navigation, and sold-out values must stay
// reachable: "disabled and visible, never hidden" includes the keyboard.
// Arrow keys move focus through ALL values; selection happens only on
// click/Enter/Space and is a no-op on unavailable ones.
export function OptionPicker({
  options,
  variants,
  selection,
  onSelect,
}: {
  options: PickerOption[];
  variants: PickerVariant[];
  selection: Selection;
  onSelect: (optionId: string, valueId: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {options.map((option) => (
        <OptionGroup
          key={option.id}
          option={option}
          options={options}
          variants={variants}
          selection={selection}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function OptionGroup({
  option,
  options,
  variants,
  selection,
  onSelect,
}: {
  option: PickerOption;
  options: PickerOption[];
  variants: PickerVariant[];
  selection: Selection;
  onSelect: (optionId: string, valueId: string) => void;
}) {
  const labelId = useId();
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // The roving tab stop: last focused value, else the checked one, else the first.
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const checkedId = selection[option.id] ?? null;
  const tabbableId = focusedId ?? checkedId ?? option.values[0]?.id ?? null;
  const selectedLabel = option.values.find((v) => v.id === checkedId)?.value;

  function onKeyDown(event: React.KeyboardEvent) {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const ids = option.values.map((v) => v.id);
    const current = Math.max(0, ids.indexOf(focusedId ?? tabbableId ?? ids[0]));
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? ids.length - 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? (current - 1 + ids.length) % ids.length
            : (current + 1) % ids.length;
    const nextId = ids[next];
    setFocusedId(nextId);
    refs.current.get(nextId)?.focus();
  }

  return (
    <div className="flex flex-col gap-2">
      <p id={labelId} className="text-sm font-medium text-tinta">
        {option.name}
        {selectedLabel && <span className="text-suave">: {selectedLabel}</span>}
      </p>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setFocusedId(null);
          }
        }}
      >
        {option.values.map((value) => {
          const state = valueAvailability(
            options,
            variants,
            option.id,
            value.id,
            selection,
          );
          const unavailable = state !== "selectable";
          const checked = value.id === checkedId;
          return (
            <button
              key={value.id}
              ref={(el) => {
                if (el) refs.current.set(value.id, el);
                else refs.current.delete(value.id);
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={unavailable || undefined}
              tabIndex={value.id === tabbableId ? 0 : -1}
              onFocus={() => setFocusedId(value.id)}
              onClick={() => {
                if (!unavailable) onSelect(option.id, value.id);
              }}
              className={cn(
                // Option values are chips — one of the few pill shapes allowed.
                "inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-4 text-sm transition-colors duration-150",
                checked
                  ? "border-vino bg-vino font-medium text-marfil"
                  : unavailable
                    ? "border-linea bg-transparent text-tenue"
                    : "border-linea bg-crema text-cuerpo hover:bg-arena",
              )}
            >
              {/* Colors always show swatch + name — never a swatch alone. */}
              {value.hex && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 shrink-0 rounded-full border",
                    checked ? "border-marfil/60" : "border-linea",
                  )}
                  style={{ background: value.hex }}
                />
              )}
              <span className={unavailable ? "line-through" : undefined}>
                {value.value}
              </span>
              {unavailable && (
                <span className="sr-only">
                  {state === "sold-out" ? ", agotado" : ", no disponible"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
