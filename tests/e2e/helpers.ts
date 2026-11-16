import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page } from "@playwright/test";

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
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(process.env.SEED_OWNER_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.SEED_OWNER_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

export async function registerAndVerify(page: Page, email: string, password = "correct-horse-1") {
  await page.goto("/register");
  await page.getByLabel("Name").fill("Test Customer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const mail = await waitForEmail(email, /Confirm your email/);
  await page.goto(firstLink(mail, "verify-email"));
  await expect(page.getByText("Your email is confirmed")).toBeVisible();
}
