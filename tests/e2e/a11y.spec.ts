import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAsOwner } from "./helpers";

async function scan(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    // Elements kept hidden by Next.js for back/forward navigation are not shown to anyone.
    .exclude("[hidden]")
    .analyze();
  const problems = results.violations.map(
    (v) =>
      `${path} ${v.id} (${v.impact}): ${v.nodes
        .slice(0, 3)
        .map((n) => `${n.target.join(" ")} :: ${n.any[0]?.message ?? n.failureSummary}`)
        .join(" | ")}`,
  );
  expect(problems, `${path}\n${problems.join("\n")}`).toEqual([]);
}

const STORE_PAGES = [
  "/",
  "/shop",
  "/collections",
  "/collections/loungewear",
  "/products/cotton-pyjama-set",
  "/search?q=butter",
  "/offers",
  "/cart",
  "/faq",
  "/contact",
  "/terms",
  "/orders/track",
  "/login",
  "/register",
  "/forgot-password",
];

for (const path of STORE_PAGES) {
  test(`storefront has no detectable accessibility violations: ${path}`, async ({ page }) => {
    await scan(page, path);
  });
}

const ADMIN_PAGES = [
  "/admin",
  "/admin/products",
  "/admin/products/new",
  "/admin/inventory",
  "/admin/orders",
  "/admin/content/homepage",
  "/admin/settings",
  "/admin/reports",
  "/admin/staff",
  "/admin/roles",
];

test("admin pages have no detectable accessibility violations", async ({ page }) => {
  await signInAsOwner(page);
  for (const path of ADMIN_PAGES) await scan(page, path);
});
