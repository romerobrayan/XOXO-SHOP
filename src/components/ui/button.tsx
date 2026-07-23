import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// The "neon" variant is the one glowing element per view — never render two
// neon buttons on the same screen. See CLAUDE.md "Design tokens".
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-bone text-ink hover:bg-bone/90",
        neon: "bg-neon text-ink shadow-[0_0_24px_rgba(255,43,194,0.45)] hover:bg-neon/90",
        outline: "border border-bone/20 bg-transparent text-bone hover:bg-surface",
        ghost: "text-bone hover:bg-surface",
      },
      size: {
        default: "h-12 px-6 text-body",
        // 44px minimum — thumb-first storefront, no sub-44 tap targets.
        sm: "h-11 px-4 text-small",
        icon: "size-12",
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
