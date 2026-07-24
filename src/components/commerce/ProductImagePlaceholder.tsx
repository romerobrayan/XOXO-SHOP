import { cn } from "@/lib/utils";

// Placeholder for pending product photography: diagonal arena stripes with a
// monospace label, per the brand guide — never drawn products, never stock
// photos, and honestly labeled so the client never mistakes it for a design
// choice. Real photos arrive at 4:5 on an arena background.
export function ProductImagePlaceholder({
  name,
  className,
}: {
  name: string;
  className?: string;
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
      <span className="px-4 text-center font-mono text-xs text-suave">
        Imagen pendiente · {name}
      </span>
    </div>
  );
}
