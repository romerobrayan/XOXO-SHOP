"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/select";
import { SORT_OPTIONS, type SortValue } from "../sort";

// "Ordenar" del catálogo — escribe `orden` en la URL y deja que el servidor
// ordene, así el estado es compartible igual que los filtros.
export function SortSelect({ value }: { value: SortValue }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="flex items-center gap-3 text-sm text-suave">
      Ordenar
      <Select
        value={value}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams);
          if (event.target.value === "relevancia") {
            params.delete("orden");
          } else {
            params.set("orden", event.target.value);
          }
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname, {
            scroll: false,
          });
        }}
        className="w-auto"
        aria-label="Ordenar productos"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
