import Link from "next/link";

import type { CategorySummary } from "../dto";

// Tarjeta de categoría del handoff: círculo arena con inicial Marcellus vino
// y borde oro — el estilo "sello" de la marca — más el nombre. Sin conteos ni
// fotos: la marca se apoya en tipografía.
export function CategoryTile({ category }: { category: CategorySummary }) {
  return (
    <Link
      href={`/tienda?categoria=${category.slug}`}
      className="flex flex-col items-center gap-3 rounded-md border border-linea bg-crema p-4 text-center transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card md:p-6"
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full border border-oro bg-arena font-display text-[26px] text-vino md:size-16"
      >
        {category.name.charAt(0)}
      </span>
      <span className="text-sm font-medium text-cuerpo">{category.name}</span>
    </Link>
  );
}
