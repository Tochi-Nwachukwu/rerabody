import { expect, test } from "@playwright/test";

import { sql } from "./db";
import {
  addProductToCart,
  checkoutAsGuest,
  fillCheckoutAddress,
  signInAsOwner,
  uniqueEmail,
} from "./helpers";

test("a guest buys a product with the fake provider and sees the order as paid", async ({
  page,
}) => {
  await addProductToCart(page, "cranberry-fig-lavender-body-butter");
  await page.getByRole("dialog").getByRole("link", { name: "Checkout" }).click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

  const email = uniqueEmail("buyer");
  const number = await checkoutAsGuest(page, email);

  const [order] = await sql<{ status: string; total: number }>(
    `SELECT status, total FROM "Order" WHERE number = $1`,
    [number],
  );
  expect(order.status).toBe("PAID");
  // The cart was cleared by the webhook.
  await page.goto("/cart");
  await expect(page.getByText("Your cart is empty.")).toBeVisible();
});

test("cancelling on the payment page keeps the cart", async ({ page }) => {
  await addProductToCart(page, "vanilla-body-butter");
  await page.goto("/checkout");
  await fillCheckoutAddress(page, uniqueEmail("cancel"));
  await page.getByRole("button", { name: "Pay now" }).click();
  await page.getByRole("button", { name: "Simulate expired session" }).click();
  await expect(page.getByRole("heading", { name: "Payment not completed" })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("link", { name: "Vanilla Body Butter" }).first()).toBeVisible();
});

test("a guest sends a gift set as a gift and the packing slip prints the message", async ({
  page,
  browser,
}) => {
  await addProductToCart(page, "mustard-botanical-gift-set");
  await page.goto("/checkout");
  await fillCheckoutAddress(page, uniqueEmail("gift"));
  await page.getByRole("checkbox", { name: /This order is a gift/ }).click();
  await page.getByLabel("Gift message (optional)").fill("Happy birthday! Love, Ada");
  await page.getByRole("button", { name: "Pay now" }).click();
  await page.getByRole("button", { name: "Pay (test)" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for your order" })).toBeVisible({
    timeout: 20_000,
  });

  const [order] = await sql<{ id: string; isGift: boolean; giftMessage: string }>(
    `SELECT id, "isGift", "giftMessage" FROM "Order" WHERE "giftMessage" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    ["Happy birthday! Love, Ada"],
  );
  expect(order.isGift).toBe(true);

  const admin = await browser.newPage();
  await signInAsOwner(admin);
  await admin.goto(`/admin/print/orders/${order.id}`);
  await expect(admin.getByText("A gift for you")).toBeVisible();
  await expect(admin.getByText("Happy birthday! Love, Ada")).toBeVisible();
  await expect(admin.getByText("$")).toHaveCount(0);
  await admin.close();
});
