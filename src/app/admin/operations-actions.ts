"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/validation";
import { areaInput,areaEditInput,teamDecision } from "@/lib/admin-operations/contracts";
import { operationsRpc,migrationUnavailable } from "@/lib/admin-operations/rpc";

function response(error:{code?:string;message:string}|null,success:string):FormState{
  if(migrationUnavailable(error))return {error:"This action requires the approved Phase 4C database migration. Nothing has been confirmed changed."};
  if(error)return {error:["22023","23514","40001","42501"].includes(error.code??"")?error.message:error.code==="23505"?"That name/PIN combination already exists. Reload the configured areas.":"The change could not be confirmed. Reload the current record before retrying."};
  for(const path of ["/admin/coverage","/admin/team","/admin/history","/admin/bookings","/professional/availability"])revalidatePath(path);
  return {success};
}
export async function saveCoverage(_:FormState,form:FormData):Promise<FormState>{
  const {supabase}=await requireAccount("admin");
  const parsed=(form.get("id")?areaEditInput:areaInput).safeParse(Object.fromEntries(form));
  const version=z.object({id:z.uuid().optional(),updated_at:z.iso.datetime({offset:true}).optional()}).safeParse({id:form.get("id")||undefined,updated_at:form.get("updated_at")||undefined});
  if(!parsed.success||!version.success)return {error:"Provide a name, valid PIN, active choice, reason and explicit confirmation. Reload stale records."};
  const p=parsed.data;
  const {error}=await operationsRpc(supabase,"admin_save_service_area",{p_name:p.name,p_postal_code:p.postal_code||null,p_is_active:p.active==="true",p_reason:p.reason,p_id:version.data.id,p_expected_updated_at:version.data.updated_at});
  return response(error,"Coverage area saved and audited. Professional coverage still requires separate approval.");
}
export async function changeTeamRole(_:FormState,form:FormData):Promise<FormState>{
  const {supabase,user}=await requireAccount("admin");
  const parsed=teamDecision.safeParse(Object.fromEntries(form));
  if(!parsed.success)return {error:"Repeat exact UUID lookup, give a reason and explicitly confirm the intended role decision."};
  const p=parsed.data;if(p.user_id===user.id)return {error:"You cannot change your own role here. Another authorized administrator must make that decision."};
  const {error}=await operationsRpc(supabase,"admin_change_team_role",{p_user_id:p.user_id,p_expected_role:p.expected_role,p_expected_updated_at:p.expected_updated_at,p_make_admin:p.operation==="promote",p_reason:p.reason});
  return response(error,p.operation==="promote"?"Administrator access granted and recorded in role history.":"Administrator access revoked; the account now has the customer role. History is preserved.");
}
