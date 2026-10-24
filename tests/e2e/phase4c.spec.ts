import { expect,test } from "@playwright/test";
// Run with isolated local-only Supabase config: no hosted sessions or data calls.
for(const width of [375,1440])test(`Phase 4C static content and admin gates at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto("/how-it-works");await expect(page.getByText(/professional must then accept before confirmation/)).toBeVisible();await expect(page.getByText(/No request form is live today/)).toHaveCount(0);
  await page.goto("/yoga-programs");await expect(page.getByText(/Four weeks and one calendar month are different durations/)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const path of ["/admin/coverage","/admin/team"]){await page.goto(path);await expect(page).toHaveURL(/\/login\?next=/);expect(new URL(page.url()).searchParams.get("next")).toBe(path);}
});
