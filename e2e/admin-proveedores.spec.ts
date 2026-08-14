import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

// Bloque I (c): the owner curates a staged supplier product from the panel —
// finds it, sets HER price (the supplier price is reference only), presses
// Publicar, and the product is live in the store at that price.
//
// The staged product is synthetic and imageless, seeded straight into the
// staging table: deterministic on any machine, no supplier network, no
// Cloudinary — the photo path has its own coverage (media.cloudinary.test.ts
// and admin-media.spec.ts).
const STAFF_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "ana@secreto.co";
const STAFF_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "secreto-panel-2026";

const RUN = Date.now().toString(36).toUpperCase();
const REF = `climax:e2e-curador-${RUN.toLowerCase()}`;
const NAME = `Tanga de prueba e2e ${RUN}`;

// Plain pg, not the generated Prisma client: Playwright transpiles specs as
// CJS and the generated client is ESM-only (import.meta).
async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

const PAYLOAD = {
  supplierRef: REF,
  supplier: "climax",
  supplierUrl: "https://climax.com.co/products/e2e",
  name: NAME,
  descriptionText: "Encaje suave. Prueba de extremo a extremo.",
  brand: "Sen Intimo",
  supplierCategories: ["Lencería"],
  tags: [],
  suggestedCategorySlug: "lenceria",
  supplierPriceCents: 40_000_00,
  suggestedRetailCents: null,
  priceVariesByVariant: false,
  options: [],
  specs: [{ label: "Material", value: "Encaje" }],
  images: [],
  variants: [
    {
      supplierVariantId: `e2e-${RUN}`,
      sku: `E2EC-${RUN}`,
      options: {},
      supplierPriceCents: 40_000_00,
      supplierCompareAtCents: null,
      available: true,
    },
  ],
};

test.beforeAll(async () => {
  await withDb((db) =>
    db.query(
      `INSERT INTO "SupplierStagingProduct"
         ("id", "supplierRef", "supplier", "name", "brand",
          "suggestedCategorySlug", "supplierPriceCents", "payload",
          "searchText", "fetchedAt", "updatedAt")
       VALUES ($1, $2, 'climax', $3, 'Sen Intimo', 'lenceria', $4, $5, $6, now(), now())`,
      [
        `e2e-curador-${RUN.toLowerCase()}`,
        REF,
        NAME,
        40_000_00,
        JSON.stringify(PAYLOAD),
        NAME.toLowerCase(),
      ],
    ),
  );
});

test.afterAll(async () => {
  await withDb(async (db) => {
    await db.query(`DELETE FROM "Product" WHERE "supplierRef" = $1`, [REF]);
    await db.query(
      `DELETE FROM "SupplierStagingProduct" WHERE "supplierRef" = $1`,
      [REF],
    );
  });
});

test("la dueña cura un producto del proveedor: precio propio y a la tienda", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill(STAFF_EMAIL);
  await page.getByLabel("Contraseña").fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Find it among the 1.275 with the search.
  await page.goto(
    `/admin/proveedores?q=${encodeURIComponent(`e2e ${RUN}`)}&estado=pendientes`,
  );
  const card = page.getByRole("link", { name: new RegExp(NAME) });
  await expect(card).toBeVisible();
  // The supplier price shows as reference on the card.
  await expect(card).toContainText("Ref.");
  await card.click();

  // Her price, not the supplier's: manual, $77.500.
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
  await page.getByText("Precio manual").click();
  await page.getByLabel("Precio de venta en pesos").fill("77.500");
  await page.getByRole("button", { name: "Publicar", exact: true }).click();

  // The success line, specifically — the header badge also flips to
  // "Publicado" on refresh, so match the sentence, not the word.
  await expect(page.getByText(/Publicado — desde/)).toBeVisible({
    timeout: 60_000,
  });

  // Straight to the storefront: right name, right price.
  await page.getByRole("link", { name: "Ver en la tienda →" }).click();
  await expect(page.getByRole("heading", { name: NAME })).toBeVisible();
  await expect(page.getByText(/77\.500/).first()).toBeVisible();

  // Back in the curator, the product now reads as published.
  await page.goto(
    `/admin/proveedores?q=${encodeURIComponent(`e2e ${RUN}`)}&estado=publicados`,
  );
  await expect(page.getByRole("link", { name: new RegExp(NAME) })).toContainText(
    "Publicado",
  );
});
