import { expect, test } from "@playwright/test";

import { newId, sql } from "./db";
import { addProductToCart, checkoutAsGuest, registerAndVerify, uniqueEmail } from "./helpers";

test("a guest applies a coupon and pays the discounted total", async ({ page }) => {
  const code = `E2E${Date.now().toString(36).toUpperCase()}`;
  await sql(
    `INSERT INTO "Coupon" (id, code, type, value, "isActive", "showOnOffers", "restrictedProductIds", "restrictedCategoryIds", "updatedAt") VALUES ($1, $2, 'PERCENT', 20, true, false, '{}', '{}', now())`,
    [newId(), code],
  );

  await addProductToCart(page, "mustard-botanical-robe");
  await page.goto("/cart");
  await page.getByLabel("Promo code").fill(code.toLowerCase());
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(`Code ${code} saves`)).toBeVisible();

  const number = await checkoutAsGuest(page, uniqueEmail("coupon"));
  const [order] = await sql<{
    id: string;
    subtotal: number;
    discountTotal: number;
    total: number;
    shippingTotal: number;
    couponCode: string;
  }>(
    `SELECT id, subtotal, "discountTotal", total, "shippingTotal", "couponCode" FROM "Order" WHERE number = $1`,
    [number],
  );
  expect(order.couponCode).toBe(code);
  expect(order.discountTotal).toBe(Math.floor(order.subtotal * 0.2));
  expect(order.total).toBe(order.subtotal - order.discountTotal + order.shippingTotal);
  const redemptions = await sql(`SELECT 1 FROM "CouponRedemption" WHERE "orderId" = $1`, [
    order.id,
  ]);
  expect(redemptions).toHaveLength(1);
});

const ADMIN_ROUTES = [
  "/admin",
  "/admin/products",
  "/admin/products/new",
  "/admin/categories",
  "/admin/collections",
  "/admin/inventory",
  "/admin/orders",
  "/admin/customers",
  "/admin/reviews",
  "/admin/coupons",
  "/admin/support",
  "/admin/content/homepage",
  "/admin/content/pages",
  "/admin/content/faq",
  "/admin/media",
  "/admin/staff",
  "/admin/roles",
  "/admin/reports",
  "/admin/settings",
  "/admin/audit",
  "/admin/print/orders/x",
  "/preview/home",
];

test("no admin page is reachable without a staff session", async ({ page }) => {
  for (const path of ADMIN_ROUTES.filter((p) => p.startsWith("/admin"))) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/admin\/login/);
  }
});

test("a signed-in customer is refused everywhere in the admin", async ({ page }) => {
  await registerAndVerify(page, uniqueEmail("nosy"));
  for (const path of ADMIN_ROUTES) {
    await page.goto(path);
    if (path === "/preview/home")
      await expect(
        page.getByRole("heading", { name: "We could not find that page" }),
      ).toBeVisible();
    else await expect(page, path).toHaveURL(/\/admin\/login\?error=no-access/);
  }
});

test("API routes need the right session, signature or secret", async ({ request }) => {
  expect(
    (
      await request.post("/api/uploads/presign", { data: { contentType: "image/png", size: 10 } })
    ).status(),
  ).toBe(401);
  expect((await request.post("/api/webhooks/stripe", { data: "{}" })).status()).toBe(400);
  expect(
    (
      await request.post("/api/webhooks/stripe", {
        data: "{}",
        headers: { "stripe-signature": "t=1,v1=bad" },
      })
    ).status(),
  ).toBe(400);
  expect((await request.post("/api/webhooks/resend", { data: "{}" })).status()).toBe(400);
  expect(
    (
      await request.post("/api/webhooks/resend", {
        data: "{}",
        headers: { "svix-id": "x", "svix-timestamp": "1", "svix-signature": "v1,bad" },
      })
    ).status(),
  ).toBe(400);
  expect((await request.get("/api/cron/low-stock")).status()).toBe(401);
  expect(
    (
      await request.get("/api/cron/low-stock", { headers: { authorization: "Bearer wrong" } })
    ).status(),
  ).toBe(401);
  expect(
    (await request.put("/api/uploads/local?key=media/2026/01/x.png", { data: "x" })).status(),
  ).toBe(403);
});
