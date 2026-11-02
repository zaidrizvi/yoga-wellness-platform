import { render,screen } from "@testing-library/react";
import { beforeEach,expect,it,vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:m.account}));
vi.mock("@/lib/marketplace/rpc",()=>({marketplaceRpc:m.rpc,marketplacePending:(e:{code?:string}|null)=>e?.code==="PGRST202"}));
vi.mock("@/app/professional/application-actions",()=>({reviewApplication:vi.fn()}));
vi.mock("@/components/auth/action-form",()=>({ActionForm:({children,submit}:{children:ReactNode;submit:string})=><form>{children}<button>{submit}</button></form>}));
import { ApplicationLocationReview } from "@/components/professional-applications/location-review";
const id="66000000-0000-4000-8000-000000000001",other="66000000-0000-4000-8000-000000000002",stamp="2026-10-25T01:00:00Z";
beforeEach(()=>{vi.clearAllMocks();m.account.mockResolvedValue({supabase:{}});m.rpc.mockResolvedValue({data:[{id,name:"Saket",district:"SOUTH",supported:true,active:false,updated_at:stamp,source:"https://example.org/source",approved:false},{id:other,name:"Outside Delhi",district:"NCR",supported:false,active:false,updated_at:stamp,source:null,approved:false}],error:null});});
it("shows geographic review state and leaves every authorization unselected",async()=>{
 const {container}=render(await ApplicationLocationReview({application:{id,updated_at:stamp,state:"submitted"}}));
 expect(screen.getByText(/Needs locality review/)).toBeVisible();expect(screen.getByText("Unsupported")).toBeVisible();
 expect(screen.getByLabelText("Decision for Saket")).toHaveValue("");expect(screen.getByLabelText("Decision for Outside Delhi").querySelector('option[value="authorize"]')).toBeNull();
 expect(container.querySelector('[name="postal_code"]')).toBeNull();expect(m.account).toHaveBeenCalledWith("admin");
});
it("offers the existing-trainer action on approved applications",async()=>{
 render(await ApplicationLocationReview({application:{id,updated_at:stamp,state:"approved"}}));
 expect(screen.getByRole("button",{name:"Approve Locations"})).toBeVisible();expect(screen.getByText("Review previously submitted locations")).toBeVisible();
});
it("does not render an approval action before its migration is deployed",async()=>{
 m.rpc.mockResolvedValue({data:null,error:{code:"PGRST202"}});render(await ApplicationLocationReview({application:{id,updated_at:stamp,state:"submitted"}}));
 expect(screen.getByRole("status")).toHaveTextContent(/awaits deployment/);expect(screen.queryByRole("button")).toBeNull();
});
