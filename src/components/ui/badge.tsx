import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 text-micro uppercase",
  {
    variants: {
      variant: {
        default: "bg-surface text-bone",
        outline: "border border-bone/20 text-bone",
        // Availability signals — a primary signal on cards and the PDP.
        stock: "bg-surface text-blush",
        out: "bg-surface text-bone/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
