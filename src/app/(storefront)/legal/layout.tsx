import Link from "next/link";

import { LEGAL_PAGES, LEGAL_UPDATED } from "@/lib/legal";

// Shell compartido de las cuatro páginas legales. Queda del lado "farmacia"
// de la tesis de diseño: marfil plano, una sola columna angosta, sin
// fotografía y sin adornos. Cada página compone su cuerpo con
// <LegalArticle>; acá va solo la columna, la fecha de revisión y el paso
// entre las cuatro.
export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto w-full max-w-content px-4 py-10 md:px-6 md:py-14">
      <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-10">
        {children}

        <footer className="border-t border-linea pt-6">
          <p className="font-mono text-xs text-suave">
            Actualizado el {LEGAL_UPDATED}
          </p>
          <nav
            aria-label="Otras páginas legales"
            className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm"
          >
            {LEGAL_PAGES.map((page) => (
              <Link
                key={page.slug}
                href={page.href}
                className="text-vino transition-colors duration-150 hover:text-cobre"
              >
                {page.footerLabel}
              </Link>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
}
