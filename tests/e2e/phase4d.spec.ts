import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/services", "/services/personal-yoga", "/services/naturopathy", "/services/massage-therapy", "/yoga-programs", "/professionals", "/how-it-works", "/about", "/join-as-professional"];
const entryRoutes = ["/login", "/signup", "/forgot-password", "/professional/login", "/professional/register"];

for (const width of [320, 375, 768, 1024, 1440]) {
  test(`public and account entry layouts at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 950 });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    for (const route of [...publicRoutes, ...entryRoutes]) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow: ${route} at ${width}`).toBe(true);
      if (entryRoutes.includes(route)) {
        for (const control of await page.locator('input:not([type="hidden"])').all()) {
          const metrics = await control.evaluate(element => ({ font: parseFloat(getComputedStyle(element).fontSize), height: element.getBoundingClientRect().height }));
          expect(metrics.font, route).toBeGreaterThanOrEqual(16);
          expect(metrics.height, route).toBeGreaterThanOrEqual(44);
        }
      }
      if (["/", "/services", "/signup", "/professional/register"].includes(route)) {
        await page.screenshot({ path: testInfo.outputPath(`${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${width}.png`), fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  });
}

test("keyboard menu focus, reduced motion and visible control focus", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  const email = page.getByLabel("Email address");
  await email.focus();
  const focus = await email.evaluate(element => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle }));
  expect(focus.width).toBe("2px");
  expect(focus.style).toBe("solid");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("mobile-navigation-320.png") });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
});

test("private panels retain signed-out access protection", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  for (const route of ["/account", "/account/addresses", "/account/bookings", "/book/personal-yoga", "/professional", "/professional/apply", "/professional/application-status", "/admin/bookings", "/admin/professionals", "/admin/coverage", "/admin/team"]) {
    await page.goto(route);
    expect(new URL(page.url()).pathname, route).toMatch(/^\/(professional\/)?login$/);
    await expect(page.locator('input[name="password"]')).toBeVisible();
  }
});
