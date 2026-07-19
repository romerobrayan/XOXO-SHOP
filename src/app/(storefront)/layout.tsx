import Link from "next/link";

import { AgeGate } from "@/features/age-gate/components/AgeGate";

// Storefront shell: header, nav, footer, and the age gate.
// The cart drawer joins here in Sprint 3.
export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AgeGate />
      <header className="border-b border-bone/10">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4">
          {/* The wordmark is the logo image once the asset lands — never a script webfont. */}
          <Link href="/" className="text-heading text-bone">
            XOXO
          </Link>
          <nav className="flex items-center gap-6 text-small">
            <Link href="/tienda" className="text-bone/80 hover:text-bone">
              Tienda
            </Link>
            <Link href="/carrito" className="text-bone/80 hover:text-bone">
              Carrito
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-bone/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 text-small text-bone/60">
          <p>
            Envío discreto a toda Colombia. Pago contra entrega en Medellín. El
            paquete llega en empaque neutro, sin marca ni referencia al
            contenido.
          </p>
          <p className="font-mono text-micro uppercase text-bone/60">
            Vista previa de diseño — las imágenes son provisionales y se
            reemplazan con la fotografía del proveedor.
          </p>
        </div>
      </footer>
    </>
  );
}
