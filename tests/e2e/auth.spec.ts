import { expect, test } from "@playwright/test";

for (const width of [375, 1440]) {
  test(`authentication and protected routes at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/login", "/signup", "/forgot-password"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByLabel("Email address")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.screenshot({ path: testInfo.outputPath(`recovery-${width}.png`), fullPage: true });
    for (const route of ["/account", "/account/professional", "/admin/professionals", "/admin/services", "/update-password"]) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login$/);
    }
    await page.goto("/auth/confirm");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("invalid or expired");
    await page.goto("/login?next=https://evil.example");
    await expect(page.locator('input[name="next"]')).toHaveValue("/account");
    await page.goto("/signup");
    await expect(page.locator('input[name="role"]')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`signup-${width}.png`), fullPage: true });
  });
}
