import type { Metadata } from "next";

export const metadata: Metadata = { title: "Carrito" };

// Cart — Sprint 3 (Zustand store persisted to localStorage, cart drawer).
export default function CartPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-title">Carrito</h1>
      <p className="text-body text-bone/80">Tu carrito está vacío.</p>
    </section>
  );
}
