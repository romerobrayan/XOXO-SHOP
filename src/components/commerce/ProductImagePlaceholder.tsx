import { cn } from "@/lib/utils";

// Placeholder for pending product photography: diagonal arena stripes with a
// monospace label, per the brand guide — never drawn products, never stock
// photos, and honestly labeled so the client never mistakes it for a design
// choice. Real photos arrive at 4:5 on an arena background.
export function ProductImagePlaceholder({
  name,
  className,
  // "thumb" drops the product name from the visible label: at bag-row size
  // (88px) the full string clips mid-word. The accessible name keeps it, and
  // the row prints the product name right beside the image anyway.
  size = "card",
}: {
  name: string;
  className?: string;
  size?: "card" | "thumb";
}) {
  return (
    <div
      role="img"
      aria-label={`Imagen pendiente: ${name}`}
      className={cn(
        "stripes-placeholder flex aspect-[4/5] w-full items-center justify-center overflow-hidden rounded-lg",
        className,
      )}
    >
      <span
        className={cn(
          "text-center font-mono text-suave",
          size === "thumb" ? "px-1.5 text-[10px]" : "px-4 text-xs",
        )}
      >
        Imagen pendiente{size === "card" && <> · {name}</>}
      </span>
    </div>
  );
}
