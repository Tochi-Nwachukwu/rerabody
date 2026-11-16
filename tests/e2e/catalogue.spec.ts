import { expect, test } from "@playwright/test";

import { pngFile, signInAsOwner } from "./helpers";

test("admin creates a product with two options and three images, publishes it and adjusts stock", async ({
  page,
}) => {
  const name = `E2E Robe ${Date.now()}`;
  await signInAsOwner(page);
  await page.goto("/admin/products/new");

  await page.getByLabel("Name", { exact: true }).fill(name);

  await page.getByRole("button", { name: "Add option" }).click();
  await page.locator("#opt-values-0").fill("S, M");
  await page.getByRole("button", { name: "Add option" }).click();
  await page.locator("#opt-values-1").fill("Ivory, Black");
  await expect(page.locator("fieldset legend", { hasText: "M / Black" })).toBeVisible();

  const run = Date.now().toString(36).toUpperCase();
  for (let i = 0; i < 4; i++) {
    await page.locator(`#sku-${i}`).fill(`E2E-${run}-${i}`);
    await page.locator(`#price-${i}`).fill("45.00");
    await page.locator(`#stock-${i}`).fill("2");
  }

  await page.getByRole("button", { name: "Add images" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .locator('input[type="file"]')
    .setInputFiles([pngFile("one.png"), pngFile("two.png"), pngFile("three.png")]);
  await expect(dialog.getByRole("button", { name: "Add 3 selected" })).toBeEnabled({
    timeout: 15_000,
  });
  await dialog.getByRole("button", { name: "Add 3 selected" }).click();
  await expect(page.getByText("Cover", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/c[a-z0-9]+$/, { timeout: 15_000 });
  await expect(page.getByText("Published").first()).toBeVisible();

  const sku = await page.locator("#sku-0:visible").inputValue();
  await page.goto(`/admin/inventory?q=${encodeURIComponent(sku)}`);
  await expect(page.getByRole("link", { name }).first()).toBeVisible();
  await page.getByRole("button", { name: "Adjust" }).first().click();
  await page.getByLabel("Quantity").fill("5");
  await page.getByRole("button", { name: "Save adjustment" }).click();
  await expect(page.getByText("Stock is now 7")).toBeVisible();

  await page.getByRole("button", { name: "History" }).first().click();
  await expect(page.getByRole("dialog").getByText("Restock").first()).toBeVisible();
});
