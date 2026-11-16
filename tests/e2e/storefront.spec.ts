import { expect, test } from "@playwright/test";

import { newId, sql } from "./db";

test("published products are listed and drafts are not", async ({ page }) => {
  const slug = `hidden-draft-${Date.now()}`;
  const productId = newId();
  await sql(
    `INSERT INTO "Product" (id, name, slug, status, "updatedAt") VALUES ($1, $2, $3, 'DRAFT', now())`,
    [productId, `Hidden Draft ${slug}`, slug],
  );
  await sql(
    `INSERT INTO "ProductVariant" (id, "productId", sku, "optionValues", price, stock, "updatedAt") VALUES ($1, $2, $3, '{}', 1000, 5, now())`,
    [newId(), productId, slug.toUpperCase()],
  );

  await page.goto("/shop");
  await expect(page.getByRole("link", { name: "Whipped Shea Body Butter" })).toBeVisible();
  await expect(page.getByText(`Hidden Draft ${slug}`)).toHaveCount(0);

  // Streamed (partial prerender) pages cannot change the status code after the shell is sent;
  // Next.js marks the not-found result noindex instead.
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
  expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
});

test("shop filters by category through the URL", async ({ page }) => {
  await page.goto("/shop");
  await page
    .getByRole("navigation", { name: "Categories" })
    .getByRole("button", { name: "Nightwear" })
    .click();
  await expect(page).toHaveURL(/category=nightwear/);
  await expect(page.getByRole("link", { name: "Satin Slip Nightdress" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Whipped Shea Body Butter" })).toHaveCount(0);
});

test("search finds a product from a misspelt query", async ({ page }) => {
  await page.goto("/search?q=lavendr%20buter");
  await expect(page.getByRole("link", { name: "Lavender Night Body Butter" })).toBeVisible();
});

test("the header search suggests products as you type", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("combobox", { name: "Search products" }).fill("satn slip");
  await expect(page.getByRole("option", { name: /Satin Slip Nightdress/ })).toBeVisible();
});

test("product page shows variant price and stock state", async ({ page }) => {
  await page.goto("/products/cotton-pyjama-set");
  await expect(page.getByRole("heading", { level: 1, name: "Cotton Pyjama Set" })).toBeVisible();
  await page.getByRole("button", { name: /^M/ }).click();
  await page.getByRole("button", { name: /^Sage/ }).click();
  await expect(
    page.getByText(/In stock|Only \d+ left|Sold out/).filter({ visible: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/variant=/);
  await expect(page.getByText("$52.00").filter({ visible: true }).first()).toBeVisible();
});
