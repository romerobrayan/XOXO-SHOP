import Link from "next/link";

import { CartLink } from "@/features/cart/components/CartLink";
import { NAV_CATEGORIES } from "./nav";

// Header sticky de 3 zonas: nav de categorías, wordmark centrado, Asesoría +
// Bolsa. En móvil el nav baja a una segunda fila; el wordmark sigue centrado.
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-linea bg-crema">
      <div className="mx-auto grid w-full max-w-content grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-3.5 md:px-6 md:py-[18px]">
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          {NAV_CATEGORIES.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-vino hover:text-cobre"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="logo-wordmark col-start-2 text-[26px]">
          Secreto
        </Link>
        <div className="flex items-center justify-end gap-6 text-sm font-medium">
          <Link
            href="/#asesoria"
            className="hidden text-vino hover:text-cobre sm:inline"
          >
            Asesoría
          </Link>
          <CartLink />
        </div>
      </div>
      <nav className="flex items-center justify-center gap-6 border-t border-linea px-4 py-2.5 text-sm font-medium md:hidden">
        {NAV_CATEGORIES.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="text-vino hover:text-cobre"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
