import { expect, test } from "@playwright/test";

// The other half of the loop the checkout spec opens: a customer buys, and
// the owner sees it and moves it along. Runs against the seeded demo catalog
// and the account created by `npm run admin:create`.
const STAFF_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "ana@secreto.co";
const STAFF_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "secreto-panel-2026";

async function buyOnce(page: import("@playwright/test").Page) {
  await page.goto("/tienda/lovense-lush-3");
  await page.getByRole("button", { name: "Soy mayor de 18" }).click();
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("link", { name: "Ver bolsa" }).click();
  await page.getByRole("button", { name: "Continuar con mis datos" }).click();

  await page.getByLabel("Nombre", { exact: true }).fill("Ana María Restrepo");
  await page.getByLabel("Celular (WhatsApp)").fill("+57 300 123 4567");
  await page.getByLabel("Número de documento").fill("1023456789");
  await page.getByLabel("Dirección").fill("Calle 10 # 43E-25, apto 301");
  await page.getByRole("button", { name: "Continuar al pago" }).click();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();

  const number = await page
    .getByText(/SECRETO-[2-9A-HJKMNP-Z]{6}/)
    .first()
    .innerText();
  return number.match(/SECRETO-[2-9A-HJKMNP-Z]{6}/)![0];
}

test("el panel exige sesión antes de mostrar un pedido", async ({ page }) => {
  await page.goto("/admin/pedidos");
  // Redirected to the login form, and no customer data on the way.
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible();
});

test("una asesora entra, ve el pedido y lo mueve hasta enviado", async ({
  page,
}) => {
  const orderNumber = await buyOnce(page);

  await page.goto("/admin/login");
  await page.getByLabel("Correo").fill(STAFF_EMAIL);
  await page.getByLabel("Contraseña").fill(STAFF_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Lands on the order list with the fresh order visible and pending.
  await expect(page).toHaveURL(/\/admin\/pedidos/);
  const row = page.getByRole("link", { name: new RegExp(orderNumber) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("Pendiente");
  await expect(row).toContainText("contra entrega");

  // The row links to the detail page — asserted on the href rather than by
  // clicking, because this list is force-dynamic and a click can land while
  // React is still replacing the streamed node.
  await expect(row).toHaveAttribute("href", `/admin/pedidos/${orderNumber}`);
  await page.goto(`/admin/pedidos/${orderNumber}`);

  await expect(
    page.getByRole("heading", { name: orderNumber }),
  ).toBeVisible();
  await expect(page.getByText("Lovense Lush 3")).toBeVisible();
  // Colombian invoicing fields the advisor needs to actually ship.
  await expect(page.getByText("1023456789")).toBeVisible();
  await expect(page.getByText("Medellín, Antioquia")).toBeVisible();

  // PENDING has no direct route to shipped — the reservation is consumed by
  // the PROCESSING → SHIPPED move, and the UI must not offer a shortcut.
  await expect(
    page.getByRole("button", { name: "Marcar enviado" }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Preparar" }).click();
  await expect(page.getByText("En preparación")).toBeVisible();

  // Shipping moves stock, so it is behind a confirm.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Marcar enviado" }).click();
  await expect(page.getByText("Enviado")).toBeVisible();

  await page.getByRole("button", { name: "Marcar entregado" }).click();
  await expect(page.getByText("Entregado")).toBeVisible();

  // Delivered is closed except for a refund.
  await expect(
    page.getByRole("button", { name: "Reembolsar" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Preparar" })).toHaveCount(0);
});
