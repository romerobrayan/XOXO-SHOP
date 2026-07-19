import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confirmación" };

// Order confirmation — the order number is what the customer quotes on WhatsApp.
export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-title">Pedido recibido</h1>
      <p className="font-mono text-price-sm tabular">{orderNumber}</p>
    </section>
  );
}
