import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database,Tables } from "@/lib/supabase/database.types";
import { z } from "zod";
import { ActionForm } from "@/components/auth/action-form";
import { allowAlternative } from "@/app/marketplace-actions";
export async function DirectChoice({client,booking}:{client:SupabaseClient<Database>;booking:Tables<"booking_requests">}){
 // Narrow pending-table adapter; actual hosted types stay unchanged until approval.
 const call=client.from.bind(client) as unknown as (name:"customer_booking_choices")=>{select:(columns:string)=>{eq:(name:string,id:string)=>{maybeSingle:()=>Promise<{data:unknown;error:{code?:string}|null}>}}};
 const r=await call("customer_booking_choices").select("allow_alternative").eq("booking_id",booking.id).maybeSingle();
 if(r.error){if(["42P01","PGRST205"].includes(r.error.code??""))return null;throw new Error("Professional choice details unavailable.");}if(!r.data)return null;
 const choice=z.object({allow_alternative:z.boolean()}).parse(r.data);return <section className="account-panel"><h2>Your professional choice</h2><p>{choice.allow_alternative?"You authorized administrator help choosing an alternative. A new proposal still requires your agreement.":"This request is bound to your chosen professional and offering. No alternative will be assigned without your authorization."}</p>{!choice.allow_alternative&&["pending","requires_rescheduling"].includes(booking.status)&&<ActionForm action={allowAlternative} submit="Authorize help choosing an alternative"><input type="hidden" name="booking_id" value={booking.id}/><label className="checkbox-label"><input name="confirmed" type="checkbox" value="yes" required/>I explicitly allow an administrator to propose another professional or offering. I will review and agree any new terms separately.</label></ActionForm>}</section>;
}
