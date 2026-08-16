import { expect, test } from "@playwright/test";

// Bloque D's second half, walked as the owner would: create a product, give
// it options, generate the variants, receive stock (which writes the ledger),
// publish, and see it in the store.
const STAFF_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "ana@secreto.co";
const STAFF_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "secreto-panel-2026";

// Unique per run — SKUs are globally unique and the demo DB persists.
const RUN = Date.now().toString(36).toUpperCase();

test("la dueña crea un producto con opciones, recibe stock y lo publica", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill(STAFF_EMAIL);
  await page.getByLabel("Contraseña").fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Create, born as DRAFT with its singleton variant.
  await page.goto("/admin/productos/nuevo");
  await page.getByLabel("Nombre").fill(`Babydoll e2e ${RUN}`);
  // The supplier reference doubles as the base for generated variant SKUs.
  await page.getByLabel("Referencia del proveedor").fill(`E2E-${RUN}`);
  await page.getByLabel("SKU").fill(`E2E-${RUN}`);
  await page.getByLabel("Precio").fill("95.000");
  await page.getByRole("button", { name: "Crear producto" }).click();
  await expect(page).toHaveURL(/\/admin\/productos\/[a-z0-9]+/);

  // One option with two values.
  await page.getByLabel("Nueva opción").fill("Talla");
  await page.getByRole("button", { name: "Agregar opción" }).click();
  await expect(page.getByText("Talla", { exact: true })).toBeVisible();

  const tallaInput = page.getByPlaceholder("S · 30 ml");
  await tallaInput.fill("S");
  await page.getByRole("button", { name: "Agregar valor" }).click();
  await expect(page.getByText("S", { exact: true })).toBeVisible();
  await tallaInput.fill("M");
  await page.getByRole("button", { name: "Agregar valor" }).click();
  await expect(page.getByText("M", { exact: true })).toBeVisible();

  // Generate the matrix: two new variants join the singleton.
  await page.getByLabel("Precio para las nuevas").fill("95.000");
  await page.getByRole("button", { name: "Generar combinaciones" }).click();
  await expect(page.getByText("2 variantes nuevas.")).toBeVisible();

  // Receive 5 units of the S variant — two taps and a reason.
  const sRow = page.locator("li").filter({ hasText: `E2E-${RUN}-S` });
  const plus = sRow.getByRole("button", { name: "Sumar una unidad" });
  for (let i = 0; i < 5; i++) await plus.click();
  // The reason defaults with the sign: incoming units read as a purchase.
  await expect(sRow.getByRole("combobox", { name: "Motivo" })).toHaveValue(
    "PURCHASE",
  );
  await sRow.getByRole("button", { name: "Aplicar" }).click();
  await expect(sRow.getByText("5 disp.")).toBeVisible();

  // The refused path: draining below zero is blocked by the guard.
  const minus = sRow.getByRole("button", { name: "Restar una unidad" });
  await expect(minus).toBeEnabled();

  // Publish and see it in the storefront.
  await page.getByLabel("Estado").selectOption("ACTIVE");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  await page.getByRole("link", { name: "Ver en la tienda →" }).click();
  await expect(
    page.getByRole("heading", { name: `Babydoll e2e ${RUN}` }),
  ).toBeVisible();
});
