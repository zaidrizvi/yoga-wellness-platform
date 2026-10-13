import { expect, test } from "@playwright/test";

const routes = ["/", "/services", "/services/personal-yoga", "/services/naturopathy", "/services/massage-therapy", "/yoga-programs", "/professionals", "/how-it-works", "/about"];

for (const width of [375, 768, 1024, 1440]) {
  test(`public website at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    const pageErrors: string[] = [];
    const brokenResponses: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => { if (response.status() >= 400) brokenResponses.push(response.url()); });
    const titles = new Set<string>();
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `overflow on ${route} at ${width}`).toBe(true);
      const title = await page.title();
      expect(titles.has(title), `duplicate metadata on ${route}`).toBe(false);
      titles.add(title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
      const links = await page.locator("a").evaluateAll((anchors) => anchors.map((anchor) => anchor.getAttribute("href")!));
      for (const href of links) {
        const target = new URL(href, page.url());
        expect(routes.includes(target.pathname), `unimplemented link: ${href} on ${route}`).toBe(true);
        if (target.hash && target.pathname === route) await expect(page.locator(target.hash)).toHaveCount(1);
      }
      for (const image of await page.locator("main img").all()) {
        await image.scrollIntoViewIfNeeded();
        await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBe(true);
      }
      await expect(page.getByRole("contentinfo")).toBeVisible();
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: testInfo.outputPath(`${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}-${width}.png`), fullPage: true });
    }
    expect(pageErrors).toEqual([]);
    expect(brokenResponses).toEqual([]);
  });
}

test("mobile navigation traps focus, closes on Escape/selection, and identifies the current page", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/professionals");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.click();
  const menu = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(menu.getByRole("link", { name: "Professionals" })).toHaveAttribute("aria-current", "page");
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(await page.getByRole("dialog").evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("mobile-navigation.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("link", { name: "Services", exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("desktop navigation, service links, FAQ keyboard behavior, and real 404 responses", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Services", exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
  await page.getByRole("link", { name: "Explore Personal Yoga Training" }).click();
  await expect(page).toHaveURL(/\/services\/personal-yoga$/);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Services", exact: true })).toHaveAttribute("aria-current", "page");
  const question = page.locator("summary").filter({ hasText: "Do I need previous yoga experience?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("You can explore personal yoga as a beginner", { exact: false })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("You can explore personal yoga as a beginner", { exact: false })).not.toBeVisible();
  const invalid = await request.get("/services/not-a-real-service");
  expect(invalid.status()).toBe(404);
  const response = await page.goto("/services/not-a-real-service");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("This page isn’t here");
  await page.getByRole("link", { name: "Explore Services" }).click();
  await expect(page).toHaveURL(/\/services$/);
  const about = await request.get("/about");
  expect(await about.text()).toContain('id="delhi-ncr"');
});

test("reduced motion keeps content and the mobile menu available without a slide transition", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/yoga-programs");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
});
