// @vitest-environment node
import { beforeEach,expect,it,vi } from "vitest";
const m=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),operations:vi.fn(),from:vi.fn(),select:vi.fn(),eq:vi.fn(),single:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:m.account}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/admin-operations/rpc",()=>({operationsRpc:m.operations}));
vi.mock("@/lib/marketplace/rpc",()=>({marketplaceRpc:vi.fn()}));
import { bulkCoverageDecision } from "@/app/admin/bulk-coverage-actions";
const id="60000000-0000-4000-8000-000000000001",other="60000000-0000-4000-8000-000000000002";
function form(kind="requests",ids=[id]){const f=new FormData();f.set("kind",kind);f.set("reason","LOCAL authorized decision");f.set("confirmed","yes");f.set("decision","reject");for(const id of ids)f.append("records",JSON.stringify({id,version:"2026-10-25T00:00:00Z"}));return f;}
beforeEach(()=>{vi.clearAllMocks();m.account.mockResolvedValue({supabase:m});m.rpc.mockResolvedValue({error:null});m.from.mockReturnValue(m);m.select.mockReturnValue(m);m.eq.mockReturnValue(m);m.operations.mockResolvedValue({error:null});});
it("checks admin authorization before parsing or modifying anything",async()=>{m.account.mockRejectedValue(new Error("Restricted"));await expect(bulkCoverageDecision({},form())).rejects.toThrow("Restricted");expect(m.account).toHaveBeenCalledWith("admin");expect(m.rpc).not.toHaveBeenCalled();});
it("reviews explicit selected IDs through the original guarded RPC",async()=>{expect((await bulkCoverageDecision({},form())).success).toContain("1 decisions");expect(m.rpc).toHaveBeenCalledWith("review_professional_coverage",{p_request_id:id,p_approve:false,p_feedback:"LOCAL authorized decision"});});
it("stops at failure and reports partial completion honestly",async()=>{m.rpc.mockResolvedValueOnce({error:null}).mockResolvedValueOnce({error:{code:"40001"}});expect((await bulkCoverageDecision({},form("requests",[id,other]))).error).toContain("1 of 2 decisions saved");expect(m.rpc).toHaveBeenCalledTimes(2);});
it("refuses unsupported PIN-less areas without activating them",async()=>{m.single.mockResolvedValue({data:{name:"Local area",postal_code:null,is_active:false},error:null});expect((await bulkCoverageDecision({},form("areas"))).error).toContain("0 of 1");expect(m.operations).not.toHaveBeenCalled();});
it("uses the reviewed version and existing stored mapping for activation",async()=>{m.single.mockResolvedValue({data:{name:"Local area",postal_code:"110001",is_active:false},error:null});await bulkCoverageDecision({},form("areas"));expect(m.operations).toHaveBeenCalledWith(m,"admin_save_service_area",expect.objectContaining({p_id:id,p_expected_updated_at:"2026-10-25T00:00:00Z",p_postal_code:"110001",p_is_active:true}));});
