"use server";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/validation";
import { uuid,reason,decision } from "@/lib/fulfillment/validation";
import { result } from "@/lib/fulfillment/action-result";

export async function respondTerms(_:FormState,form:FormData):Promise<FormState>{
  const {supabase}=await requireAccount("customer");
  const parsed=z.object({assignment_id:uuid,terms_hash:z.string().regex(/^[0-9a-f]{32}$/),response:decision,confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {error:"Review the proposed terms and confirm your response."};
  const {data,error}=await supabase.rpc("respond_booking_terms",{p_assignment_id:parsed.data.assignment_id,p_terms_hash:parsed.data.terms_hash,p_accept:parsed.data.response==="accept"});
  const payload=data&&typeof data==="object"&&!Array.isArray(data)?data:{};
  return result(error,payload.outcome==="expired"?"This proposal expired. No appointment has been confirmed.":payload.assignment_state&&!["proposed","accepted","in_progress","completed"].includes(String(payload.assignment_state))?"Your earlier response is recorded, but that proposal is no longer active. Review the current booking status.":parsed.data.response==="accept"?"Your agreement is recorded. The appointment still requires professional acceptance before confirmation.":"Proposal declined. Your original request remains in your history.");
}
export async function requestCancellation(_:FormState,form:FormData):Promise<FormState>{
  const {supabase}=await requireAccount("customer");
  const parsed=z.object({booking_id:uuid,reason,confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success)return {error:"Provide a cancellation reason and confirm your request."};
  const {error}=await supabase.rpc("request_booking_cancellation",{p_booking_id:parsed.data.booking_id,p_reason:parsed.data.reason});
  return result(error,"Cancellation requested. Your appointment is not cancelled until an administrator resolves the request.");
}
