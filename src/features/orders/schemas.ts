import { z } from "zod";

import { OrderStatus } from "@/generated/prisma/enums";

export const changeOrderStatusSchema = z.object({
  orderId: z.string().min(1),
  // The status the panel believes the order is in. Sent back so a stale tab
  // cannot apply a transition that was valid when the page rendered and is
  // not any more — see the compare-and-set in actions.ts.
  from: z.enum(OrderStatus),
  to: z.enum(OrderStatus),
});

export type ChangeOrderStatusInput = z.infer<typeof changeOrderStatusSchema>;
