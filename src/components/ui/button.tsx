import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// SECRETO buttons: uppercase Archivo medium with 1.5px tracking, 2px radius.
// default = .btn-primario (vino), outline = .btn-contorno, ghost = .btn-fantasma.
// Pills are reserved for chips, badges, and the WhatsApp CTA — never here.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-sm border border-transparent text-sm font-medium tracking-boton uppercase transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobre disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        default: "bg-vino text-marfil hover:bg-vino-claro active:bg-vino-profundo",
        outline: "border-vino bg-transparent text-vino hover:bg-arena",
        ghost: "text-cuerpo hover:text-vino",
      },
      size: {
        default: "h-12 px-7",
        // 44px minimum — thumb-first storefront, no sub-44 tap targets.
        sm: "h-11 px-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
