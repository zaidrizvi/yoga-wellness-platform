import { expect,test } from "@playwright/test";
for(const width of [375,1440]){
  test(`professional entry and protected continuation at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});await page.goto("/join-as-professional");await expect(page.getByRole("heading",{name:"Become an Aara Professional",exact:true})).toBeVisible();await page.getByRole("link",{name:"Apply as a Professional",exact:true}).first().click();
    await expect(page).toHaveURL(/\/professional\/register$/);await expect(page.getByRole("heading",{name:"Begin your professional application."})).toBeVisible();await expect(page.locator('input[name="next"]')).toHaveValue("/professional/apply");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.getByRole("link",{name:"Already registered? Professional login"}).click();await expect(page).toHaveURL(/\/professional\/login$/);await expect(page.getByRole("heading",{name:"Welcome to your practice."})).toBeVisible();
    for(const route of ["/professional/apply","/professional/application-status","/professional","/professional/services","/professional/availability","/professional/appointments"]){await page.goto(route);await expect(page).toHaveURL(/\/professional\/login\?next=/);expect(new URL(page.url()).searchParams.get("next")).toBe(route);}
    await page.goto("/signup");await expect(page.getByRole("heading",{name:"A little space for you."})).toBeVisible();await page.goto("/account/bookings");await expect(page).toHaveURL(/\/login\?next=%2Faccount%2Fbookings$/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
