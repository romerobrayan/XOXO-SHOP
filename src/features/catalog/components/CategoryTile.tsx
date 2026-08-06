import { Droplets, Shirt, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";

import type { CategorySummary } from "../dto";

// Tarjeta de categoría del handoff: círculo arena con borde oro — el estilo
// "sello" de la marca — más el nombre. El sello lleva un icono Lucide outline
// (stroke 1.5, vino) que identifica la familia; una categoría sin icono
// mapeado cae a la inicial Marcellus de siempre, so a category created from
// the admin panel never renders an empty seal.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  lenceria: Shirt,
  "cosmetica-intima": Droplets,
  "jugueteria-y-dispositivos": Sparkles,
};

export function CategoryTile({ category }: { category: CategorySummary }) {
  const Icon = CATEGORY_ICONS[category.slug];

  return (
    <Link
      href={`/tienda?categoria=${category.slug}`}
      className="flex flex-col items-center gap-3 rounded-md border border-linea bg-crema p-4 text-center transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card md:p-6"
    >
      <span
        aria-hidden="true"
        className="flex size-14 items-center justify-center rounded-full border border-oro bg-arena font-display text-[26px] text-vino md:size-16"
      >
        {Icon ? (
          <Icon strokeWidth={1.5} className="size-6 md:size-7" />
        ) : (
          category.name.charAt(0)
        )}
      </span>
      <span className="text-sm font-medium text-cuerpo">{category.name}</span>
    </Link>
  );
}
