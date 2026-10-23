import { expect, test } from "@playwright/test";

for (const width of [375, 1440]) {
  test(`booking discovery and authentication boundary at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/services/personal-yoga");
    const entry = page.getByRole("link", { name: "Request a booking", exact: true });
    await expect(entry).toHaveAttribute("href", "/book/personal-yoga");
    await entry.click();
    await expect(page).toHaveURL(/\/login\?next=%2Fbook%2Fpersonal-yoga$/);
    await expect(page.locator('input[name="next"]')).toHaveValue("/book/personal-yoga");
    for (const route of ["/account/addresses", "/account/bookings", "/account/bookings/00000000-0000-4000-8000-000000000001"]) {
      await page.goto(route);
      expect(new URL(page.url()).pathname).toBe("/login");
      expect(new URL(page.url()).searchParams.get("next")).toBe(route);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
