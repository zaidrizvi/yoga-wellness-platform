import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach,expect,it,vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:m.account}));
vi.mock("@/lib/marketplace/rpc",()=>({marketplaceRpc:m.rpc,marketplacePending:()=>false}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/components/auth/action-form",()=>({ActionForm:({children,submit}:{children:ReactNode;submit:string})=><form>{children}<button>{submit}</button></form>}));
import { AdminLocalityCoverage } from "@/components/admin/locality-coverage";
import { approveLocalityCoverage } from "@/app/admin/locality-coverage-actions";
const locality="10399e28-d765-55d5-aed1-27b9459e88dc",professional="66000000-0000-4000-8000-000000000001";
beforeEach(()=>{vi.clearAllMocks();m.account.mockResolvedValue({supabase:{}});m.rpc.mockResolvedValue({data:{localities:1},error:null});});
it("offers name-based coverage and surfaces missing price/schedule setup",async()=>{
 const {container}=render(<AdminLocalityCoverage localities={[{id:locality,name:"Saket",district:"SOUTH",service_areas:[]}]} professionals={[{id:professional,name:"LOCAL trainer fixture",requested_localities:[locality],approved_localities:[],approved_offerings:0,availability_windows:0}]}/>);
 const user=userEvent.setup();await user.selectOptions(screen.getByLabelText("Trainer (optional)"),professional);
 expect(screen.getByText("0 approved offerings")).toBeVisible();expect(screen.getByText("0 saved weekly availability windows")).toBeVisible();
 expect(container.querySelector('[name="locality_ids"]')).toHaveValue(locality);
 expect(screen.getByRole("button",{name:"Activate localities & approve trainer coverage"})).toBeVisible();
 expect(container.querySelector('[name="postal_code"]')).toBeNull();
});
it("requires admin authority before parsing coverage decisions",async()=>{
 m.account.mockRejectedValue(new Error("Restricted"));await expect(approveLocalityCoverage({},new FormData())).rejects.toThrow("Restricted");expect(m.account).toHaveBeenCalledWith("admin");expect(m.rpc).not.toHaveBeenCalled();
});
it("requires confirmation and passes only exact locality IDs and the explicit trainer",async()=>{
 const form=new FormData();form.append("locality_ids",locality);form.set("professional_id",professional);form.set("reason","LOCAL reviewed decision");
 expect((await approveLocalityCoverage({},form)).error).toBeTruthy();expect(m.rpc).not.toHaveBeenCalled();
 form.set("confirmed","yes");expect((await approveLocalityCoverage({},form)).success).toContain("explicitly approved");
 expect(m.rpc).toHaveBeenCalledWith({},"admin_approve_locality_coverage",{p_localities:[locality],p_professional:professional,p_reason:"LOCAL reviewed decision"});
});
