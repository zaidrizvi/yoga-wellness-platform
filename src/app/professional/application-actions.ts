"use server";
import { marketplacePending,marketplaceRpc } from "@/lib/marketplace/rpc";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/validation";
import { requireApplicant } from "@/lib/professional-applications/data";
import { applicationDetails,applicationId,updatedAt,documentFilename,credentialKind } from "@/lib/professional-applications/validation";

function saved(error:{code?:string;message:string}|null,success:string):FormState{
  if(error)return {error:["22023","40001","42501"].includes(error.code??"")?error.message:error.code==="23505"?"An application already exists. Reload to continue it.":"The change could not be confirmed. Reload your application before trying again."};
  for(const path of ["/professional/apply","/professional/application-status","/professional","/admin/professionals","/professionals","/","/admin/coverage"])revalidatePath(path);
  return {success};
}
export async function saveApplication(_:FormState,form:FormData):Promise<FormState>{
  const {supabase}=await requireApplicant();
  const details=applicationDetails.safeParse(Object.fromEntries(form));
  const identity=z.object({application_id:applicationId.optional(),updated_at:updatedAt.optional()}).safeParse({application_id:form.get("application_id")||undefined,updated_at:form.get("updated_at")||undefined});
  if(!details.success)return {error:details.error.issues[0]?.message??"Check the application details."};
  if(!identity.success)return {error:"Reload the application before saving."};
  if(form.get("use_locality_catalog")==="yes"){
    const ids=z.array(z.uuid()).max(20).safeParse(form.getAll("locality_ids"));if(!ids.success)return {error:"Choose valid named service localities."};
    const r=await marketplaceRpc(supabase,"save_application_localities",{p_details:details.data,p_locality_ids:ids.data,p_application_id:identity.data.application_id??null,p_expected_updated_at:identity.data.updated_at??null});
    if(r.error?.code==="22023"&&r.error.message.includes("active named Delhi localities"))return {error:"Saving locality preferences requires the applicant-locality database update. Your selections have not been saved yet."};
    return saved(r.error,`Draft saved. Application reference: ${r.data}. Locality choices do not grant professional coverage.`);
  }
  const {data,error}=await supabase.rpc("save_professional_application",{p_details:details.data,p_application_id:identity.data.application_id,p_expected_updated_at:identity.data.updated_at});
  return saved(error,`Draft saved. Application reference: ${data}. Add your supporting credentials below, then submit for review.`);
}
export async function uploadApplicationCredential(_:FormState,form:FormData):Promise<FormState>{
  const {supabase,user}=await requireApplicant();
  const id=applicationId.safeParse(form.get("application_id"));
  if(!id.success)return {error:"Save your application draft before uploading a credential."};
  const application=await supabase.from("professional_applications").select("id,state").eq("id",id.data).eq("applicant_id",user.id).maybeSingle();
  if(application.error||!application.data||!["draft","rejected"].includes(application.data.state))return {error:"Only your draft or changes-required application can receive credentials."};
  const file=form.get("document");
  if(!(file instanceof File))return {error:"Choose a supporting PDF, JPEG or PNG credential."};
  const kind=await credentialKind(file);
  if(!kind)return {error:"Use a genuine PDF, JPEG or PNG file matching its file type, up to 10 MB."};
  if(form.get("retention_consent")!=="yes")return {error:"Confirm the private credential retention notice before uploading."};
  const {error}=await supabase.storage.from("professional-applications").upload(`${user.id}/${id.data}/${crypto.randomUUID()}.${kind.extension}`,file,{contentType:kind.mime,upsert:false});
  return error?{error:"Upload could not be confirmed. Reload your credential list before retrying. Only drafts/changes-required applications may upload, with at most 20 files."}:saved(null,"Private credential uploaded. Uploading alone does not submit or approve your application.");
}
export async function submitApplication(_:FormState,form:FormData):Promise<FormState>{
  const {supabase}=await requireApplicant();
  const parsed=z.object({application_id:applicationId,updated_at:updatedAt,consent:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {error:"Save your details first and explicitly consent to application review."};
  const {error}=await supabase.rpc("submit_professional_application",{p_application_id:parsed.data.application_id,p_expected_updated_at:parsed.data.updated_at,p_consent:true});
  return saved(error,"Application submitted for administrator review. You remain a customer until approval. Track progress on Application Status.");
}
export async function openApplicationCredential(_:FormState,form:FormData):Promise<FormState>{
  const {supabase,user,role}=await requireAccount();
  const parsed=z.object({application_id:applicationId,filename:documentFilename}).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {error:"Invalid application document reference."};
  let query=supabase.from("professional_applications").select("id,applicant_id,document_paths").eq("id",parsed.data.application_id);
  if(role!=="admin")query=query.eq("applicant_id",user.id);
  const {data:application,error}=await query.maybeSingle();
  if(error||!application)return {error:"Application document unavailable."};
  const path=`${application.applicant_id}/${application.id}/${parsed.data.filename}`;
  if(role==="admin"&&!application.document_paths.includes(path))return {error:"Only documents pinned to a submitted application are available for review."};
  const {data,error:storageError}=await supabase.storage.from("professional-applications").createSignedUrl(path,60);
  return storageError||!data?{error:"This private document is unavailable."}:{url:data.signedUrl,success:"Private document link expires in 60 seconds."};
}
export async function reviewApplication(_:FormState,form:FormData):Promise<FormState>{
  const {supabase}=await requireAccount("admin");
  const parsed=z.object({application_id:applicationId,updated_at:updatedAt,decision:z.enum(["approve","reject","approve_locations"]),feedback:z.string().trim().min(1).max(1000),confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {error:"Choose a decision, provide feedback and confirm the reviewed application."};
  const ids=z.array(z.uuid()).max(20).safeParse(form.getAll("review_locality"));
  if(!ids.success)return {error:"Reload the requested localities before reviewing."};
  const reviews=ids.data.map(id=>({id,decision:String(form.get(`locality_decision_${id}`)??""),updated_at:String(form.get(`locality_version_${id}`)??"")}));
  if(parsed.data.decision!=="reject"&&(!reviews.length||reviews.some(r=>!["authorize","exclude"].includes(r.decision))))return {error:"Review every requested locality: explicitly authorize it or exclude it with feedback."};
  const {error}=await marketplaceRpc(supabase,"review_application_with_localities",{p_application:parsed.data.application_id,p_expected_updated_at:parsed.data.updated_at,p_decision:parsed.data.decision,p_feedback:parsed.data.feedback,p_publish_profile:form.get("publish_profile")==="yes",p_reviews:reviews});
  if(marketplacePending(error))return {error:"Combined application and locality approval requires the pending database migration. No decision was saved."};
  return saved(error,parsed.data.decision!=="reject"?"Trainer and reviewed locality coverage approved together. Published verified profiles are discoverable; services, prices and booking availability still require approval/setup.":"Changes requested. The applicant can revise and resubmit; no professional role was granted.");
}
