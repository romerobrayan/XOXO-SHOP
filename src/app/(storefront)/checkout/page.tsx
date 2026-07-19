import type { Metadata } from "next";

export const metadata: Metadata = { title: "Checkout" };

// Checkout — Sprint 3. Guest checkout is mandatory: never gate purchase behind
// registration. Address form needs department, city, documentType, documentId.
export default function CheckoutPage() {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-title">Checkout</h1>
      <p className="text-body text-bone/80">
        El checkout se construye en el Sprint 3, contra el proveedor de pago de
        prueba.
      </p>
    </section>
  );
}
