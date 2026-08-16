import { expect, test } from "@playwright/test";

// Bloque I, walked as the owner would from her phone or desk: create a
// product, photograph it (a real upload to the real Cloudinary account),
// publish it, see the photo in the store — then archive it and watch it
// vanish from the storefront while the panel keeps it.
//
// Needs CLOUDINARY_URL in the dev server's environment (.env), like
// `npm run import:check`.
const STAFF_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "ana@secreto.co";
const STAFF_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "secreto-panel-2026";

const RUN = Date.now().toString(36).toUpperCase();

// 4×5 vino-colored JPEG, 632 bytes. Deliberately different bytes from the
// vitest fixture (media.cloudinary.test.ts destroys ITS asset on teardown;
// content-addressing would make them share one).
const FOTO = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAFAAQDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDy+iiike4f/9k=",
  "base64",
);

test("la dueña sube una foto, la ve en la tienda, y al archivar desaparece", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill(STAFF_EMAIL);
  await page.getByLabel("Contraseña").fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // A product born in the panel, with its singleton variant.
  await page.goto("/admin/productos/nuevo");
  await page.getByLabel("Nombre").fill(`Foto e2e ${RUN}`);
  await page.getByLabel("SKU").fill(`E2EF-${RUN}`);
  await page.getByLabel("Precio").fill("88.000");
  await page.getByRole("button", { name: "Crear producto" }).click();
  // The lookahead matters: /admin/productos/nuevo also matches [a-z0-9]+,
  // and toHaveURL would pass before the client router leaves the form.
  await expect(page).toHaveURL(/\/admin\/productos\/(?!nuevo)[a-z0-9]+$/);
  const detailUrl = page.url();

  // The photo, straight to Cloudinary through the Server Action.
  await page.setInputFiles('input[type="file"]', {
    name: "foto-celular.jpg",
    mimeType: "image/jpeg",
    buffer: FOTO,
  });
  const thumb = page.locator('img[src*="res.cloudinary.com"]').first();
  await expect(thumb).toBeVisible({ timeout: 60_000 });
  // exact: the hint below the uploader also says "portada" in a sentence.
  await expect(page.getByText("Portada", { exact: true })).toBeVisible();

  // Publish and see it, photo included, in the storefront.
  await page.getByLabel("Estado").selectOption("ACTIVE");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Guardado.")).toBeVisible();

  const storeLink = page.getByRole("link", { name: "Ver en la tienda →" });
  const slugHref = await storeLink.getAttribute("href");
  expect(slugHref).toBeTruthy();
  await page.goto(slugHref!);
  await expect(
    page.getByRole("heading", { name: `Foto e2e ${RUN}` }),
  ).toBeVisible();
  await expect(
    page.locator('img[src*="res.cloudinary.com"]').first(),
  ).toBeVisible();

  // Archive from the detail — the clear gesture, not the estado select.
  // (Straight to the captured URL: clicking through the force-dynamic list
  // races the streamed re-render, the flake admin-orders already documents.)
  await page.goto(detailUrl);
  await page.getByRole("button", { name: "Archivar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restaurar a la tienda" }),
  ).toBeVisible();

  // Gone from the storefront: the grid does not list it…
  await page.goto("/tienda");
  await expect(page.getByText(`Foto e2e ${RUN}`)).toHaveCount(0);
  // …and the shared URL no longer resolves to a product.
  await page.goto(slugHref!);
  await expect(
    page.getByRole("heading", { name: `Foto e2e ${RUN}` }),
  ).toHaveCount(0);
});
