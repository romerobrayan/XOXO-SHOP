// The differentiating block of the PDP — designed, not linked to a policy
// page. Full factual sentences, never icons with two words: plain sentences
// read as a promise, icon rows read as marketing (DESIGN_BRIEF_PDP.md).
// The exact payment descriptor string is coordinated with the gateway; the
// copy promises neutrality without committing to a literal.
export function DiscretionBlock() {
  return (
    <section
      aria-labelledby="discretion-heading"
      className="rounded-xl bg-surface p-5"
    >
      <h2 id="discretion-heading" className="text-heading text-bone">
        Compra discreta
      </h2>
      <div className="mt-2 flex flex-col gap-2 text-body text-bone/80">
        <p>
          El paquete llega en un empaque neutro, sin logos ni ninguna
          referencia al contenido. En la guía de envío el remitente aparece
          con un nombre comercial neutro.
        </p>
        <p>
          El cobro aparece en tu extracto a nombre de un comercio neutro. Los
          correos de confirmación no incluyen nombres ni fotos de los
          productos.
        </p>
      </div>
    </section>
  );
}
