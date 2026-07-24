// Label/value pairs inside the "Especificaciones" accordion. Renders nothing
// when a product has no specs (an absent section, not an empty state).
export function SpecsTable({
  specs,
}: {
  specs: { label: string; value: string }[];
}) {
  if (specs.length === 0) return null;
  return (
    <dl className="mt-2 divide-y divide-linea">
      {specs.map((spec) => (
        <div
          key={spec.label}
          className="flex items-baseline justify-between gap-4 py-2.5"
        >
          <dt className="text-sm text-suave">{spec.label}</dt>
          <dd className="text-right text-sm text-cuerpo">{spec.value}</dd>
        </div>
      ))}
    </dl>
  );
}
