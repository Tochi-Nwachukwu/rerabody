import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

import { sql } from "./db";

/** The suite signs in many times; reset the auth rate limiter in the e2e database between sign-ins. */
export async function resetRateLimits() {
  await sql(`DELETE FROM "RateLimit"`);
}

type LoggedEmail = { to: string; subject: string; html: string; text: string };

export function readOutbox(): LoggedEmail[] {
  try {
    return readFileSync(path.join(process.cwd(), ".emails", "outbox.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as LoggedEmail);
  } catch {
    return [];
  }
}

/** Waits for an email to arrive in the log outbox and returns the newest match. */
export async function waitForEmail(to: string, subject: RegExp): Promise<LoggedEmail> {
  let found: LoggedEmail | undefined;
  await expect
    .poll(
      () => {
        found = readOutbox()
          .filter((e) => e.to === to.toLowerCase() && subject.test(e.subject))
          .at(-1);
        return !!found;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return found!;
}

export function firstLink(email: LoggedEmail, contains: string): string {
  const match = email.text.match(new RegExp(`https?://\\S*${contains}\\S*`));
  if (!match) throw new Error(`No link containing ${contains} in "${email.subject}"`);
  return match[0];
}

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@example.test`;

export async function signInAsOwner(page: Page) {
  await resetRateLimits();
  await page.goto("/admin/login");
  await page.getByLabel("Email", { exact: true }).fill(process.env.SEED_OWNER_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

export async function registerAndVerify(page: Page, email: string, password = "correct-horse-1") {
  await resetRateLimits();
  await page.goto("/register");
  await page.getByLabel("Name").fill("Test Customer");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const mail = await waitForEmail(email, /Confirm your email/);
  await page.goto(firstLink(mail, "verify-email"));
  await expect(page.getByText("Your email is confirmed")).toBeVisible();
}

/** A tiny valid PNG, so uploads go through the real presign and storage path. */
export function pngFile(name: string) {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==";
  return { name, mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

/** Adds the first in-stock variant of a seeded product to the cart from its product page. */
export async function addProductToCart(page: Page, slug: string) {
  await page.goto(`/products/${slug}`);
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Your cart" })).toBeVisible();
}

export async function fillCheckoutAddress(page: Page, email?: string) {
  if (email) await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Full name").fill("Test Buyer");
  await page.getByLabel("Phone").fill("5125550100");
  await page.getByLabel("Address line 1").fill("1 Test Street");
  await page.getByLabel("Town or city").fill("Austin");
  await page.getByLabel("State or region").fill("TX");
  await page.getByLabel("ZIP or postal code").fill("78701");
}

/** Guest checkout through the fake payment page. Returns the order number. */
export async function checkoutAsGuest(page: Page, email: string): Promise<string> {
  await page.goto("/checkout");
  await fillCheckoutAddress(page, email);
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByRole("heading", { name: /^Pay / })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Pay (test)" }).click();
  await expect(page.getByRole("heading", { name: "Thank you for your order" })).toBeVisible({
    timeout: 20_000,
  });
  const label = await page
    .getByText(/^Order RB-\d+$/)
    .filter({ visible: true })
    .first()
    .textContent();
  return label!.replace("Order ", "");
}
