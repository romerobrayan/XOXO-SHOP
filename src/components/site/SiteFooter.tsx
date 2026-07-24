import { INSTAGRAM_URL, whatsappHref } from "@/lib/contact";

// Footer vino: wordmark en oro + slogan a la izquierda, links marfil a la
// derecha. La nota de vista previa es requisito de la Fase 0 — el cliente
// aprueba un diseño con fotografía pendiente y debe saberlo.
export function SiteFooter() {
  return (
    <footer className="bg-vino text-marfil">
      <div className="mx-auto w-full max-w-content px-4 py-10 md:px-6 md:py-12">
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div>
            <p className="logo-wordmark text-[22px] text-oro">Secreto</p>
            <p className="mt-2 text-sm font-light opacity-80">
              El placer es tuyo. El secreto, nuestro.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6 text-sm">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="text-marfil hover:text-oro"
            >
              Instagram
            </a>
            <a
              href={whatsappHref("Hola, quiero una asesoría")}
              target="_blank"
              rel="noreferrer"
              className="text-marfil hover:text-oro"
            >
              WhatsApp
            </a>
            <a href="#" className="text-marfil hover:text-oro">
              Envíos y garantía
            </a>
            <a href="#" className="text-marfil hover:text-oro">
              Privacidad
            </a>
          </nav>
        </div>
        <p className="mt-8 border-t border-marfil/15 pt-4 font-mono text-xs opacity-60">
          Vista previa de diseño — la fotografía de producto es provisional y se
          reemplaza con las fotos reales sobre fondo arena.
        </p>
      </div>
    </footer>
  );
}
