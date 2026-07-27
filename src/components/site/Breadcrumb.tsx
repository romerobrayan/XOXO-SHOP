import Link from "next/link";
import { Fragment } from "react";

// Breadcrumb 13.5px del handoff: "Inicio / Catálogo / …". El último ítem es
// la página actual y no enlaza.
export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Ruta de navegación" className="text-sm text-suave">
      {items.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 && <span aria-hidden="true"> / </span>}
          {item.href ? (
            <Link href={item.href} className="text-vino hover:text-cobre">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
