import { expect, test } from "@playwright/test";

import { registerAndVerify, signInAsOwner, uniqueEmail, waitForEmail } from "./helpers";

test("the seeded owner can sign in to the admin", async ({ page }) => {
  await signInAsOwner(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});

test("signed-out visitors are sent to the admin login", async ({ page }) => {
  await page.goto("/admin/orders");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("a customer can register, verify, and is refused at /admin", async ({ page }) => {
  const email = uniqueEmail("customer");
  await registerAndVerify(page, email);
  await waitForEmail(email, /Welcome/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?error=no-access/);
  await expect(page.getByText("does not have access to the admin")).toBeVisible();
});

test("password reset responds the same for unknown emails", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Email", { exact: true }).fill(uniqueEmail("nobody"));
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText("If an account exists for that email")).toBeVisible();
});
