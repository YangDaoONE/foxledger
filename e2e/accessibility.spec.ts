import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { installSupabaseMocks, login } from "./helpers";

async function expectNoSeriousAccessibilityViolations(
  page: Page,
) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const seriousViolations = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );

  expect(seriousViolations).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await installSupabaseMocks(page);
});

test("登录页没有严重无障碍违规", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "狐狐记账" })).toBeVisible();
  await expectNoSeriousAccessibilityViolations(page);
});

test("核心登录后页面没有严重无障碍违规", async ({ page }) => {
  await login(page);

  for (const destination of ["首页", "账单", "狐狐", "统计", "设置"] as const) {
    await page.getByRole("link", { exact: true, name: destination }).click();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
    await expectNoSeriousAccessibilityViolations(page);
  }
});
