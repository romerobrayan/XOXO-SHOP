import * as React from "react";

import { cn } from "@/lib/utils";

// Native select styled as .select — the design system keeps forms native
// (HTML5 validation, mobile pickers) and only skins them.
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-12 w-full appearance-none rounded-md border border-linea bg-crema bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%228%22%3E%3Cpath%20d%3D%22M1%201l5%205%205-5%22%20fill%3D%22none%22%20stroke%3D%22%238A7364%22%20stroke-width%3D%221.5%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_16px_center] bg-no-repeat py-0 pr-10 pl-4 text-[16px] text-tinta transition-colors focus:border-oro focus:shadow-[0_0_0_3px_rgba(201,169,110,0.18)] focus:outline-none disabled:pointer-events-none disabled:opacity-50 md:text-base",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
