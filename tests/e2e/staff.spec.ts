import { expect, test } from "@playwright/test";

import { resetRateLimits, signInAsOwner, uniqueEmail, waitForEmail } from "./helpers";

test("an invited Fulfilment staff member joins and sees only what the role allows", async ({
  page,
  browser,
}) => {
  const email = uniqueEmail("staff");
  await signInAsOwner(page);
  await page.goto("/admin/staff");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Role", { exact: true }).selectOption({ label: "Fulfilment staff" });
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(page.getByText("Invitation sent")).toBeVisible();

  const mail = await waitForEmail(email, /invited/);
  const link = mail.text.match(/https?:\/\/\S*\/admin\/accept-invite\?\S+/)![0];

  const staffPage = await (await browser.newContext()).newPage();
  await resetRateLimits();
  await staffPage.goto(link);
  await staffPage.getByLabel("Your name").fill("Packer Pat");
  await staffPage.getByLabel("Choose a password").fill("packing-is-fun-1");
  await staffPage.getByLabel("Confirm password").fill("packing-is-fun-1");
  await staffPage.getByRole("button", { name: "Accept invitation" }).click();
  await expect(staffPage.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 15_000,
  });

  await staffPage.getByRole("button", { name: "Open menu" }).click();
  const nav = staffPage.getByRole("navigation", { name: "Admin" }).filter({ visible: true });
  await expect(nav.getByRole("link", { name: "Orders" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Products" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);

  await staffPage.goto("/admin/products");
  await expect(staffPage).toHaveURL(/\/admin\?denied=products\.read/);
  await expect(
    staffPage.getByText("Your role does not include access to that page."),
  ).toBeVisible();
});

test("cron routes need the secret", async ({ request }) => {
  expect((await request.get("/api/cron/low-stock")).status()).toBe(401);
  const ok = await request.get("/api/cron/low-stock", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ lowStock: expect.any(Number) });
});
