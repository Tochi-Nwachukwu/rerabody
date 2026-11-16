import { expect, test } from "@playwright/test";

import { sql } from "./db";
import {
  addProductToCart,
  checkoutAsGuest,
  readOutbox,
  signInAsOwner,
  uniqueEmail,
} from "./helpers";

test("admin walks an order from paid to delivered; one event and one email per step, even when double-clicked", async ({
  page,
}) => {
  await addProductToCart(page, "cocoa-vanilla-body-butter");
  const email = uniqueEmail("fulfil");
  const number = await checkoutAsGuest(page, email);
  const [{ id }] = await sql<{ id: string }>(`SELECT id FROM "Order" WHERE number = $1`, [number]);

  await signInAsOwner(page);
  await page.goto(`/admin/orders/${id}`);
  const actions = page.locator("section", { hasText: "Actions" });

  await actions.getByRole("button", { name: "Mark processing" }).dblclick();
  await expect(page.getByText("Processing").first()).toBeVisible();

  await actions.getByRole("button", { name: "Mark shipped" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Carrier").fill("Royal Mail");
  await dialog.getByLabel("Tracking number").fill("RM123456789GB");
  await dialog.getByRole("button", { name: "Mark shipped" }).dblclick();
  await expect(actions.getByRole("button", { name: "Mark out for delivery" })).toBeVisible();

  await actions.getByRole("button", { name: "Mark out for delivery" }).dblclick();
  await expect(actions.getByRole("button", { name: "Mark delivered" })).toBeVisible();
  await actions.getByRole("button", { name: "Mark delivered" }).dblclick();
  await expect
    .poll(
      async () =>
        (
          await sql(
            `SELECT 1 FROM "OrderStatusEvent" WHERE "orderId" = $1 AND "toStatus" = 'DELIVERED'`,
            [id],
          )
        ).length,
    )
    .toBe(1);
  await expect.poll(() => readOutbox().filter((m) => m.to === email).length).toBe(5);

  const events = await sql<{ toStatus: string }>(
    `SELECT "toStatus" FROM "OrderStatusEvent" WHERE "orderId" = $1 AND "toStatus" <> 'PENDING_PAYMENT'`,
    [id],
  );
  expect(events.map((e) => e.toStatus).sort()).toEqual([
    "DELIVERED",
    "OUT_FOR_DELIVERY",
    "PAID",
    "PROCESSING",
    "SHIPPED",
  ]);

  const logs = await sql<{ dedupeKey: string }>(
    `SELECT "dedupeKey" FROM "EmailLog" WHERE "to" = $1 ORDER BY "createdAt"`,
    [email],
  );
  expect(logs.map((l) => l.dedupeKey)).toEqual([
    `${id}:PAID`,
    `${id}:PROCESSING`,
    `${id}:SHIPPED`,
    `${id}:OUT_FOR_DELIVERY`,
    `${id}:DELIVERED`,
  ]);
  const subjects = readOutbox()
    .filter((m) => m.to === email)
    .map((m) => m.subject);
  expect(subjects).toHaveLength(5);
  expect(subjects.at(-1)).toMatch(/was delivered/);

  // The guest can follow the signed link in the email to S24.
  const shipped = readOutbox().find((m) => m.to === email && /has shipped/.test(m.subject))!;
  const link = shipped.text.match(/https?:\/\/\S*\/orders\/track\?\S+/)![0];
  await page.goto(link);
  await expect(page.getByRole("heading", { name: `Order ${number}` })).toBeVisible();
  await expect(page.getByText("RM123456789GB").filter({ visible: true }).first()).toBeVisible();
});

test("a refund from the admin restocks when ticked", async ({ page }) => {
  await addProductToCart(page, "unscented-mango-body-butter");
  const number = await checkoutAsGuest(page, uniqueEmail("refund"));
  const [{ id }] = await sql<{ id: string }>(`SELECT id FROM "Order" WHERE number = $1`, [number]);
  const [{ variantId }] = await sql<{ variantId: string }>(
    `SELECT "variantId" FROM "OrderItem" WHERE "orderId" = $1`,
    [id],
  );
  const [{ stock: before }] = await sql<{ stock: number }>(
    `SELECT stock FROM "ProductVariant" WHERE id = $1`,
    [variantId],
  );

  await signInAsOwner(page);
  await page.goto(`/admin/orders/${id}`);
  await page.getByRole("button", { name: "Refund" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Refund £/ })
    .click();
  await expect
    .poll(
      async () =>
        (await sql<{ status: string }>(`SELECT status FROM "Order" WHERE id = $1`, [id]))[0].status,
    )
    .toBe("REFUNDED");
  const [{ stock: after }] = await sql<{ stock: number }>(
    `SELECT stock FROM "ProductVariant" WHERE id = $1`,
    [variantId],
  );
  expect(after).toBe(before + 1);
});
