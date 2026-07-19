// Placeholder for pending product photography — see docs/DESIGN_BRIEF_PDP.md.
// Rules: never prettier than the real asset, varies by slug-derived tint, and
// honestly labeled so the client never mistakes it for a design choice.
const TINTS = ["#F6C9DE", "#C9B6E4", "#FF2BC2", "#F5325B"] as const;

function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

export function ProductImagePlaceholder({
  name,
  seed,
}: {
  name: string;
  seed: string;
}) {
  const tint = tintFor(seed);
  return (
    <div
      role="img"
      aria-label={`Imagen pendiente: ${name}`}
      className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-surface"
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          background: `radial-gradient(120% 90% at 50% 15%, ${tint}, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-bone/40">
          Imagen pendiente
        </span>
        <span className="font-sans text-sm text-bone/70">{name}</span>
      </div>
    </div>
  );
}
