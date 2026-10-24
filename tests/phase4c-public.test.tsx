import { render,screen } from "@testing-library/react";
import { expect,it,vi } from "vitest";
import { ServiceDetail } from "@/components/public/service-detail";
import { getService } from "@/content/services";
import { appointmentJourney } from "@/content/process";
import robots from "@/app/robots";
vi.mock("server-only",()=>({}));
vi.mock("@/config/site",()=>({site:{name:"Aara",url:new URL("https://aara.example")},navigation:[{href:"/",label:"Home"},{href:"/professionals",label:"Professionals"}]}));
vi.mock("@/lib/data/public",()=>({publishedServices:async()=>[{slug:"personal-yoga"}]}));
import sitemap from "@/app/sitemap";
it("never displays legacy platform numbers as a trainer booking quote",()=>{
  render(<ServiceDetail service={{...getService("personal-yoga")!,price:{amountInRupees:12345,currency:"INR"},durationMinutes:777}}/>);
  expect(screen.getByText(/Approved professional offerings set their own prices/)).toBeVisible();expect(screen.queryByText(/12,345/)).not.toBeInTheDocument();expect(screen.queryByText(/777 minutes/)).not.toBeInTheDocument();
});
it("explains both customer agreement and professional acceptance",()=>{
  const content=appointmentJourney.map(s=>s.description).join(" ");expect(content).toMatch(/Explicitly accept or decline/);expect(content).toMatch(/professional must accept/);expect(content).not.toMatch(/No request form is live/);
});
it("includes recruitment and published services in the canonical sitemap",async()=>{
  const rows=await sitemap();expect(rows.map(r=>r.url)).toContain("https://aara.example/join-as-professional");expect(rows.map(r=>r.url)).toContain("https://aara.example/services/personal-yoga");
});
it("blocks private professional paths without blocking directory or recruitment",()=>{
  const rules=robots().rules;expect(Array.isArray(rules)).toBe(false);const disallow=(rules as {disallow:string[]}).disallow;expect(disallow).toContain("/professional/");expect(disallow).toContain("/professional$");expect(disallow).not.toContain("/professional");expect(disallow).not.toContain("/professionals");expect(disallow).not.toContain("/join-as-professional");
});
