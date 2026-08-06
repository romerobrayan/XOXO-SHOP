import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/generated/prisma/enums";
import { STATUS_LABEL } from "../transitions";

// Tone carries "does this need me": PENDING is the only one the owner has to
// act on, so it is the only one that gets the brand colour. Delivered is a
// quiet success, cancelled/refunded read as error, the middle states stay
// neutral so a long list does not turn into a traffic light.
const TONE: Record<
  OrderStatus,
  "default" | "vino" | "oro" | "exito" | "error"
> = {
  PENDING: "vino",
  PAID: "oro",
  PROCESSING: "default",
  SHIPPED: "default",
  DELIVERED: "exito",
  CANCELLED: "error",
  REFUNDED: "error",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
