// The ONLY place optionKey is computed. The variant's optionKey is the sorted,
// joined list of its option value IDs — it enforces combination uniqueness via
// @@unique([productId, optionKey]), which Prisma cannot express over a relation.
// An option-less product has exactly one variant with optionKey "".
export function computeOptionKey(optionValueIds: string[]): string {
  return [...optionValueIds].sort().join("|");
}
