import * as React from "react";

import { cn } from "@/lib/utils";

// .input del design system: crema, borde línea, foco oro con halo suave.
// 16px on touch viewports — smaller triggers input zoom on iOS.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full rounded-md border border-linea bg-crema px-4 text-[16px] text-tinta transition-colors placeholder:text-tenue focus:border-oro focus:shadow-[0_0_0_3px_rgba(201,169,110,0.18)] focus:outline-none disabled:pointer-events-none disabled:opacity-50 md:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
