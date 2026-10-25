"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { operationsRpc } from "@/lib/admin-operations/rpc";
import { marketplaceRpc } from "@/lib/marketplace/rpc";
import type { FormState } from "@/lib/auth/validation";

export async function bulkCoverageDecision(_:FormState,form:FormData):Promise<FormState>{
 const {supabase}=await requireAccount("admin");
 const input=z.object({kind:z.enum(["areas","localities","requests"]),reason:z.string().trim().min(1).max(1000),confirmed:z.literal("yes"),decision:z.enum(["approve","reject"]).optional()}).safeParse(Object.fromEntries(form));
 const recordSchema=z.array(z.object({id:z.uuid(),version:z.iso.datetime({offset:true}).optional()})).min(1).max(100);
 let decoded:unknown;try{decoded=form.getAll("records").map(v=>JSON.parse(String(v)));}catch{return {error:"Invalid record selection. Reload before retrying."};}
 const records=recordSchema.safeParse(decoded);
 if(!input.success||!records.success||new Set(records.data.map(r=>r.id)).size!==records.data.length)return {error:"Choose 1–100 distinct records, a reason and explicit confirmation."};
 const {kind,reason,decision}=input.data;if(kind==="requests"&&!decision)return {error:"Choose an explicit review decision."};
 let completed=0,failed="";
 for(const record of records.data){
  if(kind!=="requests"&&!record.version){failed="Missing reviewed version. Reload.";break;}
  if(kind==="requests"){
   const r=await supabase.rpc("review_professional_coverage",{p_request_id:record.id,p_approve:decision==="approve",p_feedback:reason});
   if(r.error){failed="Coverage review was refused. Reload pending requests and review eligibility.";break;}
  }else if(kind==="areas"){
   const r=await supabase.from("service_areas").select("name,postal_code,is_active,updated_at").eq("id",record.id).single();
   if(r.error||!r.data||r.data.is_active||!r.data.postal_code?.match(/^[1-9][0-9]{5}$/)){failed="Area is unavailable, already active or lacks a valid configured PIN. Reload.";break;}
   const save=await operationsRpc(supabase,"admin_save_service_area",{p_id:record.id,p_expected_updated_at:record.version,p_name:r.data.name,p_postal_code:r.data.postal_code,p_is_active:true,p_reason:reason});
   if(save.error){failed="Area activation was refused or the reviewed version changed. Reload.";break;}
  }else{
   const r=await supabase.from("marketplace_localities" as never).select("*").eq("id",record.id).single();
   const locality=z.object({name:z.string(),district:z.string(),region_code:z.string(),source_url:z.string(),verified:z.literal(true),is_active:z.literal(false)}).safeParse(r.data);
   const mapping=await supabase.from("locality_service_areas" as never).select("service_area_id").eq("locality_id",record.id);
   const ids=z.array(z.object({service_area_id:z.uuid()})).min(1).max(30).safeParse(mapping.data);
   if(r.error||mapping.error||!locality.success||!ids.success){failed="Locality must already be verified and mapped. Reload.";break;}
   const l=locality.data;const save=await marketplaceRpc(supabase,"admin_save_marketplace_locality",{p_id:record.id,p_name:l.name,p_district:l.district,p_region:l.region_code,p_source:l.source_url,p_verified:true,p_active:true,p_area_ids:ids.data.map(a=>a.service_area_id),p_expected_updated_at:record.version,p_reason:reason});
   if(save.error){failed="Locality activation was refused: mappings must be active and the reviewed version current. Reload.";break;}
  }
  completed++;
 }
 for(const path of ["/admin/coverage","/admin/coverage/localities","/admin/services/offerings","/admin/history","/professional/availability","/professionals","/"])revalidatePath(path);
 return failed?{error:`${completed} of ${records.data.length} decisions saved. ${failed} Remaining records were not processed; do not blindly resubmit.`}:{success:`${completed} decisions saved through existing guarded operations. Professional approval remains separately required.`};
}
