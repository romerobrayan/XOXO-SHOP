import { redirect } from "next/navigation";

// La bolsa vive en el paso 1 del checkout (handoff §4). /carrito queda como
// alias para enlaces antiguos.
export default function CartPage() {
  redirect("/checkout");
}
