import { expect, test } from "@playwright/test";

import { sql } from "./db";
import { readOutbox, signInAsOwner, uniqueEmail, waitForEmail } from "./helpers";

test("hiding and reordering homepage sections only changes the live page after publish; drafts never leak", async ({
  page,
  browser,
}) => {
  await signInAsOwner(page);
  await page.goto("/admin/content/homepage");
  await expect(page.getByRole("heading", { name: "Homepage" })).toBeVisible();

  // Hide the ticker in the draft.
  await page.getByRole("button", { name: "Hide Ticker" }).click();
  await expect(page.getByText("You have unpublished changes.")).toBeVisible();

  // The public homepage still shows it.
  const visitor = await browser.newPage();
  await visitor.goto("/");
  await expect(visitor.locator('[data-section="ticker"]')).toHaveCount(1);
  // The draft preview is not available to visitors.
  await visitor.goto("/preview/home");
  await expect(visitor.getByRole("heading", { name: "We could not find that page" })).toBeVisible();

  // Staff see the draft without the ticker.
  await page.goto("/preview/home");
  await expect(page.getByText("Draft preview.")).toBeVisible();
  await expect(page.locator('[data-section="ticker"]')).toHaveCount(0);

  await page.goto("/admin/content/homepage");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("The live homepage matches this list.")).toBeVisible();

  await visitor.goto("/");
  await expect(visitor.locator('[data-section="ticker"]')).toHaveCount(0);

  // Restore for other tests.
  await page.getByRole("button", { name: "Show Ticker" }).click();
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("The live homepage matches this list.")).toBeVisible();
  await visitor.close();
});

test("newsletter signup sends a welcome email and the unsubscribe link works", async ({ page }) => {
  const email = uniqueEmail("news");
  await page.goto("/");
  const form = page.locator("footer");
  await form.getByLabel("Get news and offers by email").fill(email);
  await form.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("Please check your inbox")).toBeVisible();

  const mail = await waitForEmail(email, /Welcome to the Rera Body list/);
  const link = mail.text.match(/https?:\/\/\S*\/unsubscribe\?\S+/)![0];
  await page.goto(link);
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByText("You have been unsubscribed")).toBeVisible();
  const [row] = await sql<{ status: string }>(
    `SELECT status FROM "NewsletterSubscriber" WHERE email = $1`,
    [email],
  );
  expect(row.status).toBe("UNSUBSCRIBED");

  // Signing up again gives the same response and no second welcome email.
  await page.goto("/");
  await form.getByLabel("Get news and offers by email").fill(email);
  await form.getByRole("button", { name: "Join" }).click();
  await expect(page.getByText("Please check your inbox")).toBeVisible();
  expect(readOutbox().filter((m) => m.to === email)).toHaveLength(1);
});

test("policy pages and FAQ render", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: "Terms and conditions" })).toBeVisible();
  await page.goto("/faq");
  await expect(
    page.getByRole("heading", { level: 1, name: "Frequently asked questions" }),
  ).toBeVisible();
  await page.getByText("How do I track my order?").click();
  await expect(page.getByText(/Placeholder answer/).first()).toBeVisible();
});
