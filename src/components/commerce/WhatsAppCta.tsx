import { whatsappHref } from "@/lib/contact";
import { cn } from "@/lib/utils";

// El único CTA con forma pill del sistema — el canal de venta real del negocio.
// Sentence case, sin uppercase: conversación, no botón de tienda.
export function WhatsAppCta({
  message,
  children,
  className,
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={whatsappHref(message)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-oro bg-transparent px-6 text-sm text-cobre transition-colors duration-150 hover:bg-crema",
        className,
      )}
    >
      {children} →
    </a>
  );
}
