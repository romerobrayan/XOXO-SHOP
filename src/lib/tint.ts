// Deterministic brand-palette tint from a slug — used by the image
// placeholder and the category tiles so surfaces vary without real imagery.
// Subtle by design: the tint renders at low opacity over --color-surface.
const TINTS = ["#F6C9DE", "#C9B6E4", "#FF2BC2", "#F5325B"] as const;

export function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}
