import { faInstagram, faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";

import { INSTAGRAM_URL, whatsappHref } from "@/lib/contact";
import { LEGAL_PAGES } from "@/lib/legal";

// Footer vino: wordmark en oro + slogan a la izquierda, links marfil a la
// derecha. La nota de vista previa es requisito de la Fase 0 — el cliente
// aprueba un diseño con fotografía pendiente y debe saberlo.
//
// Las cuatro páginas legales salen de LEGAL_PAGES y no de una lista escrita a
// mano: son alcanzables desde cualquier página del sitio, que es requisito del
// onboarding de la pasarela (el análisis de riesgo revisa la tienda en vivo,
// docs/decisions/002-pasarela-wompi-vs-payu.md).
//
// Iconos: los glifos de marca vienen de Font Awesome Brands (rellenos — un
// logo no se redibuja en outline; excepción a la regla de la guía, registrada
// en docs/ESTADO-Y-SIGUIENTE-SESION.md), siempre acompañados del texto.
// Heredan el marfil del link (la regla cuerpo/vino asume superficie clara).
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
              className="inline-flex items-center gap-1.5 text-marfil hover:text-oro"
            >
              <FontAwesomeIcon
                icon={faInstagram}
                aria-hidden="true"
                className="size-4"
              />
              Instagram
            </a>
            <a
              href={whatsappHref("Hola, quiero una asesoría")}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-marfil hover:text-oro"
            >
              <FontAwesomeIcon
                icon={faWhatsapp}
                aria-hidden="true"
                className="size-4"
              />
              WhatsApp
            </a>
          </nav>
        </div>

        <nav
          aria-label="Información legal"
          className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm"
        >
          {LEGAL_PAGES.map((page) => (
            <Link
              key={page.slug}
              href={page.href}
              className="text-marfil transition-colors duration-150 hover:text-oro"
            >
              {page.footerLabel}
            </Link>
          ))}
        </nav>
        <p className="mt-8 border-t border-marfil/15 pt-4 font-mono text-xs opacity-60">
          Vista previa de diseño — la fotografía de producto es provisional y se
          reemplaza con las fotos reales sobre fondo arena.
        </p>
      </div>
    </footer>
  );
}
