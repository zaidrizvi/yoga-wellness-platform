import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const mocks=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:mocks.account}));
vi.mock("next/cache",()=>({revalidatePath:mocks.revalidate}));
import { saveOffering,respondAssignment,saveSchedule } from "@/app/professional/actions";
import { proposeBooking,reviewOffering } from "@/app/admin/fulfillment-actions";
import { respondTerms } from "@/app/account/bookings/actions";
const id="00000000-0000-4000-8000-000000000001";
function form(values:Record<string,string>){const f=new FormData();Object.entries(values).forEach(([k,v])=>f.set(k,v));return f;}
beforeEach(()=>{vi.clearAllMocks();mocks.account.mockResolvedValue({supabase:{rpc:mocks.rpc},user:{id},role:"customer"});mocks.rpc.mockResolvedValue({data:id,error:null});});
describe("fulfillment actions — mocked Supabase, not hosted acceptance",()=>{
  it("requires professional authorization and never passes self-approval or arbitrary owner fields",async()=>{
    const output=await saveOffering({},form({service_id:id,offering_type:"single_session",title:"Treatment",description:"Details",duration_minutes:"60",price:"1250.25",delivery_notes:"",professional_id:"another-user",state:"approved",suspended:"false"}));
    expect(output.success).toBeTruthy();expect(mocks.account).toHaveBeenCalledWith("professional");
    expect(mocks.rpc).toHaveBeenCalledWith("save_professional_offering",expect.objectContaining({p_terms:expect.objectContaining({price_minor:125025})}));
    expect(mocks.rpc.mock.calls[0][1].p_terms).not.toHaveProperty("state");expect(mocks.rpc.mock.calls[0][1].p_terms).not.toHaveProperty("professional_id");
  });
  it("requires admin authorization, converts India time and keeps retry identity",async()=>{
    const values={booking_id:id,offering_id:id,revision_id:id,starts_at:"2026-11-01T09:00",idempotency_key:id,reason:"Eligible match",confirmed:"yes",customer_id:"another",status:"confirmed",price_minor:"1"};
    await proposeBooking({},form(values));await proposeBooking({},form(values));
    expect(mocks.account).toHaveBeenCalledWith("admin");expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1]);
    expect(mocks.rpc.mock.calls[0]).toEqual(["propose_booking_offering",{p_booking_id:id,p_offering_id:id,p_revision_id:id,p_starts_at:"2026-11-01T09:00:00+05:30",p_idempotency_key:id,p_reason:"Eligible match"}]);
  });
  it("reports a real database overlap rejection without success or invalidation",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"23P01",message:"exclusion violation"}});
    const output=await proposeBooking({},form({booking_id:id,offering_id:id,revision_id:id,starts_at:"2026-11-01T09:00",idempotency_key:id,reason:"Match",confirmed:"yes"}));
    expect(output.error).toMatch(/slot or request changed/);expect(output.success).toBeUndefined();expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("binds customer agreement to the exact quote and never accepts client price/status",async()=>{
    mocks.rpc.mockResolvedValue({data:{outcome:"accepted"},error:null});
    const output=await respondTerms({},form({assignment_id:id,terms_hash:"a".repeat(32),response:"accept",confirmed:"yes",price_minor:"1",customer_id:"another",status:"confirmed"}));
    expect(mocks.account).toHaveBeenCalledWith("customer");expect(mocks.rpc).toHaveBeenCalledWith("respond_booking_terms",{p_assignment_id:id,p_terms_hash:"a".repeat(32),p_accept:true});expect(output.success).toMatch(/requires professional acceptance/);
  });
  it("does not turn expired agreement or professional responses into confirmation",async()=>{
    mocks.rpc.mockResolvedValue({data:{outcome:"expired"},error:null});
    expect((await respondTerms({},form({assignment_id:id,terms_hash:"a".repeat(32),response:"accept",confirmed:"yes"}))).success).toMatch(/expired/);
    expect((await respondAssignment({},form({assignment_id:id,response:"accept",reason:"Ready",confirmed:"yes"}))).success).toMatch(/No appointment was confirmed/);
  });
  it("does not claim success if professional acceptance lacks customer agreement",async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:{code:"22023",message:"Customer must first agree to price, terms and exact schedule"}});
    const output=await respondAssignment({},form({assignment_id:id,response:"accept",reason:"Ready",confirmed:"yes"}));expect(output.error).toMatch(/Customer must first agree/);expect(output.success).toBeUndefined();
  });
  it("requires explicit approval confirmation and stops before RPC when authorization fails",async()=>{
    expect((await reviewOffering({},form({revision_id:id,decision:"approve",feedback:"Reviewed"}))).error).toBeTruthy();expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.account.mockRejectedValue(new Error("Restricted"));await expect(reviewOffering({},form({}))).rejects.toThrow("Restricted");expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid schedule windows without replacing the saved schedule",async()=>{
    const f=form({weekday:"1",start:"12:00",end:"09:00",confirmed:"yes"});expect((await saveSchedule({},f)).error).toBeTruthy();expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
