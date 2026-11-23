import { expect, test } from "@playwright/test";

import { sql } from "./db";
import { addProductToCart, checkoutAsGuest, fillCheckoutAddress, uniqueEmail } from "./helpers";

test("a guest buys a product with the fake provider and sees the order as paid", async ({
  page,
}) => {
  await addProductToCart(page, "unscented-mango-body-butter");
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
  await addProductToCart(page, "whipped-shea-body-butter");
  await page.goto("/checkout");
  await fillCheckoutAddress(page, uniqueEmail("cancel"));
  await page.getByRole("button", { name: "Pay now" }).click();
  await page.getByRole("button", { name: "Simulate expired session" }).click();
  await expect(page.getByRole("heading", { name: "Payment not completed" })).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("link", { name: "Whipped Shea Body Butter" }).first()).toBeVisible();
});
