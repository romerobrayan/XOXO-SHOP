import { expect, test } from "@playwright/test";

// The whole reason the store exists, walked as a customer would: age gate,
// product page, bag, the three checkout steps, and a SECRETO- order number
// at the end. Runs against the seeded demo catalog — lovense-lush-3 is the
// option-less product, so no option picking stands between add and buy.
test("un cliente compra contra entrega de punta a punta", async ({ page }) => {
  await page.goto("/tienda/lovense-lush-3");

  // Age gate on first visit — dismissible, per compliance rule 1.
  await page.getByRole("button", { name: "Soy mayor de 18" }).click();

  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("link", { name: "Ver bolsa" }).click();

  // Paso 1 — Bolsa
  await expect(page.getByRole("heading", { name: "Tu bolsa" })).toBeVisible();
  await expect(page.getByText("Lovense Lush 3").first()).toBeVisible();
  await page.getByRole("button", { name: "Continuar con mis datos" }).click();

  // Paso 2 — Datos, including the Colombian invoicing fields
  await page.getByLabel("Nombre", { exact: true }).fill("Ana María Restrepo");
  await page.getByLabel("Celular (WhatsApp)").fill("+57 300 123 4567");
  await page.getByLabel("Número de documento").fill("1023456789");
  await page.getByLabel("Dirección").fill("Calle 10 # 43E-25, apto 301");
  await page.getByRole("button", { name: "Continuar al pago" }).click();

  // Paso 3 — contra entrega is preselected; confirm.
  await expect(page.getByText("Contra entrega")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();

  // Confirmation — a real Order exists behind this number.
  await expect(
    page.getByRole("heading", { name: "Pedido confirmado" }),
  ).toBeVisible();
  await expect(page.getByText(/SECRETO-[2-9A-HJKMNP-Z]{6}/)).toBeVisible();

  // The bag emptied only after the server confirmed.
  await page.getByRole("link", { name: "Volver a la tienda" }).click();
  await expect(page.getByRole("link", { name: /Bolsa/ })).toContainText("0");
});

// The online path, up to the payment redirect. Which redirect depends on the
// environment: with real pub_test_ keys (PAYMENT_PROVIDER=wompi) the browser
// lands on Wompi's hosted checkout carrying our signed link — the sandbox
// accepting it IS the integrity-signature verification; with the mock (CI,
// keyless machines) it lands straight on our return page. Both prove the
// same contract: order created, Payment row written, customer sent to pay.
test("un pago en línea llega hasta el redirect a la pasarela", async ({
  page,
}) => {
  await page.goto("/tienda/lovense-lush-3");
  await page.getByRole("button", { name: "Soy mayor de 18" }).click();

  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByRole("link", { name: "Ver bolsa" }).click();
  await page.getByRole("button", { name: "Continuar con mis datos" }).click();

  await page.getByLabel("Nombre", { exact: true }).fill("Ana María Restrepo");
  await page.getByLabel("Celular (WhatsApp)").fill("+57 300 123 4567");
  // Required for online payment — the gateway needs it.
  await page.getByLabel(/Correo/).fill("compradora@ejemplo.co");
  await page.getByLabel("Número de documento").fill("1023456789");
  await page.getByLabel("Dirección").fill("Calle 10 # 43E-25, apto 301");
  await page.getByRole("button", { name: "Continuar al pago" }).click();

  await page.getByText("Transferencia o tarjeta").click();
  await page.getByRole("button", { name: "Confirmar pedido" }).click();

  // "commit" and not "load": Wompi's page is external and its load time is
  // not this storefront's to answer for.
  await page.waitForURL(/checkout\.wompi\.co|\/checkout\/gracias/, {
    timeout: 30_000,
    waitUntil: "commit",
  });

  const url = new URL(page.url());
  if (url.hostname === "checkout.wompi.co") {
    // The signed link arrived whole: reference, amount and signature.
    expect(url.searchParams.get("reference")).toMatch(
      /^SECRETO-[2-9A-HJKMNP-Z]{6}$/,
    );
    expect(url.searchParams.get("signature:integrity")).toMatch(
      /^[0-9a-f]{64}$/,
    );
    expect(url.searchParams.get("amount-in-cents")).toMatch(/^\d+$/);
    expect(url.searchParams.get("expiration-time")).toBeTruthy();
  } else {
    // Mock: the return page owns the confirmation and makes the WhatsApp
    // promise — there is no gateway behind the link to wait for.
    await expect(
      page.getByRole("heading", { name: "Pedido registrado" }),
    ).toBeVisible();
    await expect(page.getByText(/SECRETO-[2-9A-HJKMNP-Z]{6}/)).toBeVisible();
  }
});
