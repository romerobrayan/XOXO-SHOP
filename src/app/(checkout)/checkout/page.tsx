import type { Metadata } from "next";

import { CheckoutFlow } from "@/features/checkout/components/CheckoutFlow";
import { getShippingZones } from "@/features/shipping/queries";

export const metadata: Metadata = { title: "Checkout" };

// Las tarifas de domicilio son dinero, y esta página las cotiza: prerenderizada
// serviría las zonas que existían al hacer el build, y la clienta puede
// editarlas cualquier día desde el panel. El cobro lo decide createOrder
// leyendo la base, así que un resumen congelado mostraría un total distinto
// al que se cobra — justo lo que este checkout evita en todo lo demás.
export const dynamic = "force-dynamic";

// Guest checkout is mandatory — no account, no registration, ever.
//
// The delivery zones are read here, on the server, and handed to the flow as
// props: the fee has to update as the buyer fills in the address, and a round
// trip per keystroke would be both slower and no safer — createOrder resolves
// the fee again against these same zones before it charges anything.
export default async function CheckoutPage() {
  const zones = await getShippingZones();

  return (
    <div className="mx-auto w-full max-w-[1000px] px-4 py-8 md:px-6 md:py-10">
      <CheckoutFlow zones={zones} />
    </div>
  );
}
