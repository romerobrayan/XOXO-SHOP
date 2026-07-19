// Label/value pairs with the value in mono — the specs table reads as a
// datasheet, which is the trust register this category needs. Renders nothing
// when a product has no specs (an absent section, not an empty state).
export function SpecsTable({
  specs,
}: {
  specs: { label: string; value: string }[];
}) {
  if (specs.length === 0) return null;
  return (
    <section aria-labelledby="specs-heading">
      <h2 id="specs-heading" className="text-heading text-bone">
        Especificaciones
      </h2>
      <dl className="mt-3 divide-y divide-bone/10">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="flex items-baseline justify-between gap-4 py-2.5"
          >
            <dt className="text-small text-bone/70">{spec.label}</dt>
            <dd className="tabular text-right font-mono text-small text-bone">
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
