import { test,expect } from "@playwright/test";
import { readFileSync,readdirSync } from "node:fs";
for (const width of [375,1440]) test(`role-aware navigation at ${width}px (mocked status only)`, async ({page}) => {
 await page.setViewportSize({width,height:950});
 for (const scenario of [
  {status:{authenticated:false},links:["Login","Signup"],absent:["My Account","Application Status"],join:true},
  {status:{authenticated:true,role:"customer",applicationPendingOrRejected:false},links:["My Account","My Bookings"],absent:["Application Status","Professional Dashboard"],join:false},
  {status:{authenticated:true,role:"customer",applicationPendingOrRejected:true},links:["My Account","Application Status"],absent:["My Bookings","Professional Dashboard"],join:false},
  {status:{authenticated:true,role:"professional"},links:["Professional Dashboard","Appointments"],absent:["My Account","Application Status"],join:false},
  {status:{authenticated:true,role:"admin"},links:["Admin Dashboard"],absent:["My Account","Professional Dashboard","Application Status"],join:false},
 ]) {
  await page.route("**/auth/status",route=>route.fulfill({json:scenario.status}));
  await page.goto("/");
  if(width<1151) await page.getByRole("button",{name:"Open navigation"}).click();
  const account=page.getByRole("navigation",{name:width<1151?"Mobile account":"Your account",exact:true});
  for(const label of scenario.links) await expect(account.getByRole("link",{name:label,exact:true})).toBeVisible();
  for(const label of scenario.absent) await expect(account.getByRole("link",{name:label,exact:true})).toHaveCount(0);
  const primary=page.getByRole("navigation",{name:width<1151?"Mobile navigation":"Main navigation",exact:true});
  await expect(primary.getByRole("link",{name:"Join as Professional",exact:true})).toHaveCount(scenario.join?1:0);
  if(scenario.status.authenticated) await expect(account.getByRole("button",{name:"Logout",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width<1151) await page.keyboard.press("Escape");
  await page.unroute("**/auth/status");
 }
});
const id="60000000-0000-4000-8000-000000000001";
test("deployed catalog supports anonymous search, unserved selection and clearing",async({page})=>{
 const locality="aeee68be-ec2b-5d71-adb1-8cab1990f636"; // Actual imported Aali catalog identifier, not fabricated coverage.
 for(const route of ["/","/professionals"]){
  const response=await page.goto(route);expect(response?.status()).toBe(200);await expect(page.getByRole("heading",{level:1})).toBeVisible();
  const location=page.getByRole("combobox",{name:"Select your location (optional)"});
  await expect(location).toHaveAttribute("placeholder","All Delhi");
  await expect(page.getByText(/The full Delhi name catalog awaits separate database approval/)).toHaveCount(0);
  await location.fill("Aali");await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
  await expect(page.locator('input[name="area"]')).toHaveValue(locality);await expect(location).toHaveValue(/Aali/);
  await page.getByRole("button",{name:"Find Trainers"}).click();await expect(page).toHaveURL(new RegExp(`area=${locality}`));
  await expect(page.getByText("No professionals available in this area yet.",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Clear filters · All Delhi",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(route==="/"?"/$":"/professionals$"));
  await expect(page.locator('input[name="area"]')).toHaveValue("");
  await expect(page.getByText(route==="/"?"No eligible professionals are published for this view yet.":"No approved professionals match these filters.",{exact:true})).toBeVisible();
 }
});
for(const width of [320,375,768,1024,1440])test(`public marketplace empty-inventory UI at ${width}px`,async({page},info)=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:950});
 for(const route of ["/","/professionals","/services/personal-yoga",`/professionals/${id}`,`/book/offering/${id}?revision=${id}`,"/yoga-programs"]){const response=await page.goto(route);expect(response?.status()).toBe(200);await expect(page.getByRole("heading",{level:1})).toBeVisible();expect(new URL(page.url()).pathname).not.toMatch(/login|signup/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route).toBe(true);if(route==="/"||route==="/professionals"){await expect(page.getByRole("combobox",{name:"Select your location (optional)"})).toHaveAttribute("placeholder","All Delhi");await expect(page.getByText(/No eligible professionals are published for this view yet|No approved professionals match these filters|Trainer discovery and direct booking are temporarily unavailable/)).toBeVisible();await page.screenshot({path:info.outputPath(`${route==="/"?"home":"directory"}-${width}.png`),fullPage:true});}}
});
for(const width of [320,768,1440])test(`real location component keyboard and multi-select at ${width}px (local fixture only)`,async({page},info)=>{
 await page.setViewportSize({width,height:900});await page.goto("/robots.txt");await page.setContent('<html lang="en"><head></head><body><div id="location-fixture"></div></body></html>');
 for(const file of readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')))await page.addStyleTag({content:readFileSync(`.next/static/chunks/${file}`,'utf8')});
 await page.addScriptTag({content:readFileSync('node_modules/.cache/location-browser.js','utf8')});
 const input=page.getByRole("combobox",{name:"Select your location (optional)"});await input.fill("South");await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");await expect(page.locator('input[name="area"]')).toHaveValue("60000000-0000-4000-8000-000000000002");await expect(input).toHaveValue(/South test grouping/);await page.getByRole("button",{name:"Clear selected location"}).click();await expect(page.locator('input[name="area"]')).toHaveValue("");
 const multi=page.getByRole("combobox",{name:"Search Delhi localities"});await multi.fill("North");await page.keyboard.press("Enter");await expect(page.locator('[name="locality_ids"]')).toHaveCount(1);await page.getByRole("button",{name:"Remove LOCAL fixture area"}).click();await expect(page.locator('[name="locality_ids"]')).toHaveCount(0);await multi.fill("not present");await expect(page.getByText("No matching localities.")).toBeVisible();await page.keyboard.press("Escape");await expect(multi).toHaveAttribute("aria-expanded","false");expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await input.fill("North");await page.screenshot({path:info.outputPath(`combobox-${width}.png`),fullPage:true});
});
test("new administrative screens remain protected",async({page})=>{for(const route of ["/admin/bundles","/admin/coverage/localities","/professional/availability","/account/addresses"]){await page.goto(route);expect(new URL(page.url()).pathname).toMatch(/login$/);}});
test("booking context survives switching login and signup without creating an account",async({page})=>{
 const next=`/book/offering/${id}?revision=${id}&area=${id}&start=2026-11-01T10%3A00`;
 await page.goto(`/login?next=${encodeURIComponent(next)}`);await page.getByRole("link",{name:"Create account",exact:true}).click();
 await expect(page).toHaveURL(/\/signup\?next=/);const continuation=new URL(new URL(page.url()).searchParams.get("next")!,"https://aara.invalid");expect(continuation.pathname).toBe(`/book/offering/${id}`);expect(continuation.searchParams.get("start")).toBe("2026-11-01T10:00");
 await page.getByRole("navigation",{name:"Account options"}).getByRole("link",{name:"Login",exact:true}).click();await expect(page).toHaveURL(/\/login\?next=/);expect(new URL(new URL(page.url()).searchParams.get("next")!,"https://aara.invalid").searchParams.get("area")).toBe(id);
});
