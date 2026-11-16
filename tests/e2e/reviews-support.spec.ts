import { expect, test } from "@playwright/test";

import { sql } from "./db";
import {
  addProductToCart,
  fillCheckoutAddress,
  readOutbox,
  registerAndVerify,
  signInAsOwner,
  uniqueEmail,
  waitForEmail,
} from "./helpers";

test("a customer reviews a delivered product and it appears after the admin approves it", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("reviewer");
  await registerAndVerify(page, email);

  await addProductToCart(page, "lace-trim-cami-set");
  await page.goto("/checkout");
  await fillCheckoutAddress(page);
  await page.getByRole("button", { name: "Pay now" }).click();
  await page.getByRole("button", { name: "Pay (test)" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for your order" })).toBeVisible({
    timeout: 20_000,
  });

  const [order] = await sql<{ id: string }>(`SELECT id FROM "Order" WHERE email = $1`, [email]);
  // Fast-forward delivery; the admin flow itself is covered in fulfilment.spec.ts.
  await sql(`UPDATE "Order" SET status = 'DELIVERED' WHERE id = $1`, [order.id]);

  await page.goto(`/account/orders/${order.id}`);
  await page.getByRole("link", { name: "Review Lace Trim Cami Set" }).click();
  await page.getByRole("radio", { name: "5 stars" }).click();
  await page.getByLabel("Your review").fill("Beautiful lace and a great fit. Would buy again.");
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText("Your review is waiting for approval")).toBeVisible();

  // Hidden until approved.
  await page.goto("/products/lace-trim-cami-set");
  await expect(page.locator("#reviews").filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator("#reviews").getByText("Beautiful lace and a great fit")).toHaveCount(0);

  const admin = await browser.newPage();
  await signInAsOwner(admin);
  await admin.goto("/admin/reviews");
  const card = admin.locator("li", { hasText: "Beautiful lace and a great fit" });
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Review approved and published")).toBeVisible();
  await admin.close();

  await page.goto("/products/lace-trim-cami-set");
  await expect(
    page
      .getByText("Beautiful lace and a great fit. Would buy again.")
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Verified buyer").filter({ visible: true }).first()).toBeVisible();
  const [p] = await sql<{ ratingCount: number }>(
    `SELECT "ratingCount" FROM "Product" WHERE slug = 'lace-trim-cami-set'`,
  );
  expect(p.ratingCount).toBeGreaterThanOrEqual(1);
});

test("the contact form opens a ticket and the admin reply is emailed", async ({ page }) => {
  const email = uniqueEmail("contact");
  await page.goto("/contact");
  await page.getByLabel("Name").fill("Curious Customer");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Subject").fill("Sizing question");
  await page.getByLabel("Message").fill("Does the satin slip run small or true to size?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByText(/Your reference is T-\d+/)).toBeVisible();
  await waitForEmail(email, /We received your message/);

  const [ticket] = await sql<{ id: string }>(`SELECT id FROM "SupportTicket" WHERE email = $1`, [
    email,
  ]);
  await signInAsOwner(page);
  await page.goto(`/admin/support/${ticket.id}`);
  await page.getByLabel("Reply").fill("It runs true to size. We hope that helps!");
  await page.getByRole("button", { name: "Send and close" }).click();
  await expect(page.getByText("Reply emailed to the customer")).toBeVisible();
  const reply = await waitForEmail(email, /Re: your message/);
  expect(reply.text).toContain("It runs true to size");
  expect(readOutbox().filter((m) => m.to === email)).toHaveLength(2);
});
