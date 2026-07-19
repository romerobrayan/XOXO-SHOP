import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // text-body (16px) minimum — smaller triggers input zoom on iOS.
        "h-12 w-full rounded-lg border border-bone/20 bg-surface px-4 text-body text-bone placeholder:text-bone/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bone disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
