// @vitest-environment node
import { beforeEach,describe,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({account:vi.fn(),rpc:vi.fn(),from:vi.fn(),upload:vi.fn(),signed:vi.fn(),revalidate:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:m.account}));
vi.mock("next/cache",()=>({revalidatePath:m.revalidate}));
import { saveApplication,submitApplication,reviewApplication,uploadApplicationCredential,openApplicationCredential } from "@/app/professional/application-actions";
import { applicationDetails,credentialKind } from "@/lib/professional-applications/validation";
const id="00000000-0000-4000-8000-000000000001",other="00000000-0000-4000-8000-000000000002",stamp="2026-10-24T01:00:00+00:00";
const detail={full_name:"Applicant",phone:"9876543210",category_id:id,qualifications:"Qualifications",years_experience:"2.5",biography:"Relevant experience",specializations:"",service_locations:"Delhi",postal_codes:"110001, 110002"};
function form(values:Record<string,string>){const f=new FormData();Object.entries(values).forEach(([k,v])=>f.set(k,v));return f;}
function query(data:unknown){const q={eq:vi.fn(),maybeSingle:vi.fn(async()=>({data,error:null}))};q.eq.mockReturnValue(q);m.from.mockReturnValue({select:()=>q});return q;}
beforeEach(()=>{vi.clearAllMocks();m.account.mockResolvedValue({supabase:{rpc:m.rpc,from:m.from,storage:{from:()=>({upload:m.upload,createSignedUrl:m.signed})}},user:{id,email_confirmed_at:stamp},role:"customer"});m.rpc.mockResolvedValue({data:id,error:null});});
describe("professional onboarding actions (mocked Supabase)",()=>{
  it("saves only applicant fields, never owner/approval/role input",async()=>{
    expect((await saveApplication({},form({...detail,applicant_id:other,state:"approved",role:"professional",reviewed_by:other}))).success).toContain(id);
    expect(m.account).toHaveBeenCalledWith("customer");const [rpc,args]=m.rpc.mock.calls[0];expect(rpc).toBe("save_professional_application");expect(args.p_details.postal_codes).toEqual(["110001","110002"]);
    for(const key of ["applicant_id","state","role","reviewed_by"])expect(args.p_details).not.toHaveProperty(key);
    expect(m.rpc.mock.calls.some(([name])=>name==="change_user_role")).toBe(false);
  });
  it("allows incomplete drafts, rejects invalid PINs and fractional experience precision",()=>{
    expect(applicationDetails.safeParse({...detail,full_name:"",category_id:"",years_experience:"",postal_codes:""}).success).toBe(true);
    expect(applicationDetails.safeParse({...detail,postal_codes:"../secret"}).success).toBe(false);
    expect(applicationDetails.safeParse({...detail,years_experience:"1.25"}).success).toBe(false);
  });
  it("requires consent and binds submission to the saved version",async()=>{
    expect((await submitApplication({},form({application_id:id,updated_at:stamp}))).error).toBeTruthy();expect(m.rpc).not.toHaveBeenCalled();
    await submitApplication({},form({application_id:id,updated_at:stamp,consent:"yes",state:"approved"}));expect(m.rpc).toHaveBeenCalledWith("submit_professional_application",{p_application_id:id,p_expected_updated_at:stamp,p_consent:true});
  });
  it("approves only through the atomic admin RPC and never reports failed promotion as approved",async()=>{
    m.rpc.mockResolvedValue({data:null,error:{code:"42501",message:"Administrator required"}});
    const output=await reviewApplication({},form({application_id:id,updated_at:stamp,decision:"approve",feedback:"Reviewed",confirmed:"yes",publish_profile:"yes"}));
    expect(m.account).toHaveBeenCalledWith("admin");expect(output.error).toBe("Administrator required");expect(output.success).toBeUndefined();
    expect(m.rpc).toHaveBeenCalledWith("review_professional_application",{p_application_id:id,p_expected_updated_at:stamp,p_decision:"approve",p_feedback:"Reviewed",p_publish_profile:true});expect(m.rpc).toHaveBeenCalledTimes(1);expect(m.revalidate).not.toHaveBeenCalled();
  });
  it("rejects operations before mutation when account authorization fails",async()=>{
    m.account.mockRejectedValue(new Error("Restricted"));await expect(saveApplication({},form(detail))).rejects.toThrow("Restricted");expect(m.rpc).not.toHaveBeenCalled();
  });
  it("rejects unsupported/mismatched credential bytes and oversized credentials",async()=>{
    expect(await credentialKind(new File(["fake content"],"credential.pdf",{type:"application/pdf"}))).toBeNull();
    expect(await credentialKind(new File(["%PDF-1.7"],"credential.png",{type:"image/png"}))).toBeNull();
    expect(await credentialKind(new File([new Uint8Array(10*1024*1024+1)],"large.pdf",{type:"application/pdf"}))).toBeNull();
    expect(await credentialKind(new File(["%PDF-1.7"],"credential.pdf",{type:"application/pdf"}))).toEqual({extension:"pdf",mime:"application/pdf"});
  });
  it("uses owner/application/UUID private upload paths, retention consent and no upsert",async()=>{
    const q=query({id,state:"draft"});m.upload.mockResolvedValue({error:null});const f=form({application_id:id,retention_consent:"yes"});f.set("document",new File(["%PDF-1.7"],"credential.pdf",{type:"application/pdf"}));
    expect((await uploadApplicationCredential({},f)).success).toMatch(/Private credential uploaded/);expect(q.eq).toHaveBeenCalledWith("applicant_id",id);
    expect(m.upload.mock.calls[0][0]).toMatch(new RegExp(`^${id}/${id}/[0-9a-f-]+\\.pdf$`));expect(m.upload.mock.calls[0][2]).toEqual({contentType:"application/pdf",upsert:false});
  });
  it("does not upload to a submitted or another owner's inaccessible application",async()=>{
    query(null);expect((await uploadApplicationCredential({},form({application_id:other}))).error).toBeTruthy();expect(m.upload).not.toHaveBeenCalled();
    query({id,state:"submitted"});expect((await uploadApplicationCredential({},form({application_id:id}))).error).toBeTruthy();expect(m.upload).not.toHaveBeenCalled();
  });
  it("requires pinned submitted paths for admin document review",async()=>{
    m.account.mockResolvedValue({supabase:{from:m.from,storage:{from:()=>({createSignedUrl:m.signed})}},user:{id:other},role:"admin"});query({id,applicant_id:id,document_paths:[]});
    expect((await openApplicationCredential({},form({application_id:id,filename:`${id}.pdf`}))).error).toMatch(/pinned/);expect(m.signed).not.toHaveBeenCalled();
  });
});
