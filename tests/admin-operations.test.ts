import { beforeEach,describe,expect,it,vi } from "vitest";
import { readFileSync } from "node:fs";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:m.account}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidate}));
import { saveCoverage,changeTeamRole } from "@/app/admin/operations-actions";
import { areaInput,areaEditInput } from "@/lib/admin-operations/contracts";
import { migrationUnavailable } from "@/lib/admin-operations/rpc";
const id="00000000-0000-4000-8000-000000000001",other="00000000-0000-4000-8000-000000000002",stamp="2026-10-24T02:00:00+00:00";
function form(v:Record<string,string>){const f=new FormData();Object.entries(v).forEach(([k,v])=>f.set(k,v));return f;}
beforeEach(()=>{vi.clearAllMocks();m.account.mockResolvedValue({supabase:{rpc:m.rpc},user:{id},role:"admin"});m.rpc.mockResolvedValue({data:other,error:null});});
describe("admin operations: mocked RPCs, no hosted execution",()=>{
  it.each(["000000","12345","1234567","../110001","A10001"])("rejects invalid PIN %s",pin=>expect(areaInput.safeParse({name:"Area",postal_code:pin,active:"true",reason:"Reviewed",confirmed:"yes"}).success).toBe(false));
  it("allows deactivation of legacy PIN-less areas without weakening new-area PIN validation",()=>{
    const row={name:"Legacy area",postal_code:"",active:"false",reason:"Retired",confirmed:"yes"};expect(areaEditInput.safeParse(row).success).toBe(true);expect(areaInput.safeParse(row).success).toBe(false);expect(areaEditInput.safeParse({...row,active:"true"}).success).toBe(false);
  });
  it("requires admin and explicit confirmation before an area write",async()=>{
    expect((await saveCoverage({},form({name:"Area",postal_code:"110001",active:"true",reason:"Reviewed"}))).error).toBeTruthy();expect(m.account).toHaveBeenCalledWith("admin");expect(m.rpc).not.toHaveBeenCalled();
  });
  it("preserves an existing area UUID/version and calls only the controlled write",async()=>{
    await saveCoverage({},form({id:other,updated_at:stamp,name:"Area",postal_code:"110001",active:"false",reason:"Coverage paused",confirmed:"yes",professional_id:id}));
    expect(m.rpc).toHaveBeenCalledWith("admin_save_service_area",{p_name:"Area",p_postal_code:"110001",p_is_active:false,p_reason:"Coverage paused",p_id:other,p_expected_updated_at:stamp});
  });
  it.each(["customer","professional"])("denies %s actions before any RPC when the role guard rejects",async()=>{
    m.account.mockRejectedValue(new Error("Restricted"));await expect(saveCoverage({},form({}))).rejects.toThrow("Restricted");await expect(changeTeamRole({},form({}))).rejects.toThrow("Restricted");expect(m.rpc).not.toHaveBeenCalled();
  });
  it("requires exact-account version and disallows self role changes",async()=>{
    const input={user_id:id,expected_role:"admin",expected_updated_at:stamp,operation:"revoke",reason:"Reviewed",confirmed:"yes"};expect((await changeTeamRole({},form(input))).error).toMatch(/own role/);expect(m.rpc).not.toHaveBeenCalled();
    await changeTeamRole({},form({...input,user_id:other}));expect(m.rpc).toHaveBeenCalledWith("admin_change_team_role",{p_user_id:other,p_expected_role:"admin",p_expected_updated_at:stamp,p_make_admin:false,p_reason:"Reviewed"});
  });
  it("surfaces last-admin rejection without success or a direct role write",async()=>{
    m.rpc.mockResolvedValue({data:null,error:{code:"23514",message:"Cannot remove the last eligible administrator"}});
    const output=await changeTeamRole({},form({user_id:other,expected_role:"admin",expected_updated_at:stamp,operation:"revoke",reason:"Reviewed",confirmed:"yes"}));expect(output.error).toMatch(/last eligible/);expect(output.success).toBeUndefined();expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("never reports pending backend actions as operational",async()=>{
    m.rpc.mockResolvedValue({data:null,error:{code:"PGRST202",message:"Function unavailable"}});
    const output=await saveCoverage({},form({name:"Area",postal_code:"110001",active:"true",reason:"Reviewed",confirmed:"yes"}));expect(output.error).toMatch(/requires.*migration/);expect(output.success).toBeUndefined();expect(migrationUnavailable({code:"42501"})).toBe(false);
  });
  it("retains database protections in the SQL proposal, independently of UI gates",()=>{
    const sql=readFileSync('supabase/migrations/20261024020000_admin_operations_and_customer_history.sql','utf8');
    expect(sql).toContain('perform public.change_user_role(');expect(sql).toContain('Cannot remove the last eligible administrator');expect(sql).toContain('revoke insert,update,delete on public.service_areas from authenticated');expect(sql).toContain('Referenced PIN is immutable');
    const timeline=sql.split('create function public.customer_booking_timeline')[1].split('grant execute')[0];expect(timeline).toContain('customer_id=auth.uid()');expect(timeline).toContain('returns table(event_id uuid,event_key text,occurred_at timestamptz)');expect(timeline).not.toContain('e.reason');expect(timeline).not.toContain('e.actor_user_id');
  });
});
