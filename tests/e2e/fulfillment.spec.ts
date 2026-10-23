import { expect,test } from "@playwright/test";

for(const width of [375,1440]){
  test(`Phase 4B public offering and role boundaries at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto("/services/personal-yoga");
    await expect(page.getByRole("heading",{name:"Care, with clear terms."})).toBeVisible();
    await expect(page.getByRole("link",{name:"Request a booking",exact:true})).toHaveAttribute("href","/book/personal-yoga");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const route of ["/professional/services","/professional/availability","/professional/appointments","/admin/bookings","/admin/services/offerings","/admin/history","/account/bookings"]){
      await page.goto(route);await expect(page).toHaveURL(/\/login\?next=/);expect(new URL(page.url()).searchParams.get("next")).toBe(route);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
