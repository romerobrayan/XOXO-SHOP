// URL slugs for products, brands, and categories. Spanish names carry
// diacritics, so strip them before slugifying: "Cosmetica intima" -> "cosmetica-intima".
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
