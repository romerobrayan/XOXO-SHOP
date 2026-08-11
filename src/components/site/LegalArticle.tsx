import { Breadcrumb } from "@/components/site/Breadcrumb";
import { legalPage, type LegalSlug } from "@/lib/legal";

// Envoltura de una página legal: breadcrumb, kicker, titular Marcellus,
// entradilla y el cuerpo con la tipografía de lectura larga.
//
// La tipografía del cuerpo se declara una sola vez, acá, con variantes
// descendientes — así las páginas quedan siendo HTML semántico plano y no
// una lista de clases repetidas cuatro veces. El titular y la entradilla
// viven fuera de ese contenedor para que no los pise la regla de <p>.
export function LegalArticle({
  slug,
  kicker,
  lead,
  children,
}: {
  slug: LegalSlug;
  kicker: string;
  lead: string;
  children: React.ReactNode;
}) {
  const page = legalPage(slug);

  return (
    <article>
      <Breadcrumb
        items={[{ label: "Inicio", href: "/" }, { label: page.title }]}
      />

      <p className="kicker mt-6 text-cobre">{kicker}</p>
      <h1 className="mt-3 font-display text-2xl text-tinta md:text-3xl">
        {page.title}
      </h1>
      <p className="mt-4 text-lg text-cuerpo">{lead}</p>

      <div
        className={[
          "mt-2",
          "[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-tinta",
          "[&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-lg [&_h3]:text-tinta",
          "[&_p]:mt-4 [&_p]:text-base [&_p]:text-cuerpo",
          "[&_ul]:mt-4 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2.5",
          "[&_li]:relative [&_li]:pl-5 [&_li]:text-base [&_li]:text-cuerpo",
          // Viñeta propia: guion largo en cobre, sin bullets del navegador.
          "[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-cobre [&_li]:before:content-['—']",
          "[&_a]:text-vino [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-cobre",
          "[&_strong]:font-semibold [&_strong]:text-tinta",
        ].join(" ")}
      >
        {children}
      </div>
    </article>
  );
}
