"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Inicio" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/proveedores", label: "Proveedores" },
  { href: "/admin/domicilios", label: "Domicilios" },
];

export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-linea bg-crema">
      <div className="mx-auto flex w-full max-w-5xl gap-4 overflow-x-auto px-4 sm:gap-6">
        {TABS.map((tab) => {
          // "/admin" would prefix-match every panel route; the home tab only
          // lights up on itself.
          const active =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 py-3 text-[13px] font-medium tracking-boton uppercase transition-colors duration-150",
                active
                  ? "border-vino text-vino"
                  : "border-transparent text-cuerpo hover:text-vino",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
