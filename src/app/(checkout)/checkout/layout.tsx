import Link from "next/link";

import { AnnouncementBar } from "@/components/site/AnnouncementBar";
import { AgeGate } from "@/features/age-gate/components/AgeGate";
import { CartHydration } from "@/features/cart/components/CartHydration";

// Checkout shell per handoff §4: header simplificado (solo el wordmark), la
// barra de anuncio cambia a la promesa de empaque, y el footer queda en el
// slogan. Menos ruido donde el comprador necesita más confianza.
export default function CheckoutLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AgeGate />
      <CartHydration />
      <AnnouncementBar>
        Empaque neutro y remitente genérico — nadie sabrá qué llegó
      </AnnouncementBar>
      <header className="border-b border-linea bg-crema">
        <div className="mx-auto flex w-full max-w-content items-center justify-center px-6 py-[18px]">
          <Link href="/" className="logo-wordmark text-[26px]">
            Secreto
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="bg-vino text-marfil">
        <div className="mx-auto flex w-full max-w-content justify-center px-6 py-8">
          <p className="text-sm font-light opacity-80">
            El placer es tuyo. El secreto, nuestro.
          </p>
        </div>
      </footer>
    </>
  );
}
