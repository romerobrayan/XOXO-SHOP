import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// SECRETO badges — one of the few pill shapes in the system. Tones mirror
// tokens/components.css: base, vino (contador de bolsa), oro (destacados),
// exito (disponible / garantía), error (agotado).
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-[5px] text-[11px] tracking-[1px] uppercase",
  {
    variants: {
      variant: {
        default: "border-linea bg-crema text-suave",
        vino: "border-vino bg-vino text-marfil",
        oro: "border-oro bg-oro text-tinta",
        exito: "border-exito bg-transparent text-exito",
        error: "border-error bg-transparent text-error",
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
