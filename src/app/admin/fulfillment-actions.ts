"use server";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/validation";
import { uuid, reason, indiaInstant } from "@/lib/fulfillment/validation";
import { result } from "@/lib/fulfillment/action-result";

export async function reviewOffering(_: FormState, form: FormData): Promise<FormState> {
  const {supabase}=await requireAccount("admin");
  const parsed=z.object({revision_id:uuid,decision:z.enum(["approve","reject"]),feedback:reason,confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:"Choose a decision, give review feedback and confirm."};
  const {error}=await supabase.rpc("review_professional_offering",{p_revision_id:parsed.data.revision_id,p_approve:parsed.data.decision==="approve",p_feedback:parsed.data.feedback});
  return result(error,"Offering review saved. Only approved terms are public while the professional remains eligible.");
}
export async function suspendOffering(_: FormState, form: FormData): Promise<FormState> {
  const {supabase}=await requireAccount("admin");
  const parsed=z.object({offering_id:uuid,suspended:z.enum(["true","false"]),reason,confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:"Provide a reason and confirm the visibility change."};
  const {error}=await supabase.rpc("set_professional_offering_suspended",{p_offering_id:parsed.data.offering_id,p_suspended:parsed.data.suspended==="true",p_reason:parsed.data.reason});
  return result(error,"Offering visibility updated. A suspended offering cannot receive assignments.");
}
export async function reviewCoverage(_: FormState, form: FormData): Promise<FormState> {
  const {supabase}=await requireAccount("admin");
  const parsed=z.object({request_id:uuid,decision:z.enum(["approve","reject"]),feedback:reason,confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:"Provide a decision, feedback and confirmation."};
  const {error}=await supabase.rpc("review_professional_coverage",{p_request_id:parsed.data.request_id,p_approve:parsed.data.decision==="approve",p_feedback:parsed.data.feedback});
  return result(error,"Coverage request reviewed.");
}
export async function proposeBooking(_: FormState, form: FormData): Promise<FormState> {
  const {supabase}=await requireAccount("admin");
  const parsed=z.object({booking_id:uuid,offering_id:uuid,revision_id:uuid,starts_at:indiaInstant,idempotency_key:uuid,reason,confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:"Choose an approved available offering, an exact India time, a reason and confirmation."};
  const {data,error}=await supabase.rpc("propose_booking_offering",{p_booking_id:parsed.data.booking_id,p_offering_id:parsed.data.offering_id,p_revision_id:parsed.data.revision_id,p_starts_at:parsed.data.starts_at,p_idempotency_key:parsed.data.idempotency_key,p_reason:parsed.data.reason});
  return result(error,`Proposal recorded (${data ?? ""}). Customer agreement is required before professional acceptance. Replaying the same retry key returns the original proposal; inspect its current status below.`);
}
export async function manageCancellation(_: FormState, form: FormData): Promise<FormState> {
  const {supabase}=await requireAccount("admin");
  const parsed=z.object({booking_id:uuid,operation:z.enum(["cancel","approve_request","decline_request"]),reason,confirmed:z.literal("yes")}).safeParse(Object.fromEntries(form));
  if(!parsed.success) return {error:"Provide a valid cancellation decision, reason and confirmation."};
  const {error}=parsed.data.operation==="cancel"
    ? await supabase.rpc("cancel_booking_fulfillment",{p_booking_id:parsed.data.booking_id,p_reason:parsed.data.reason})
    : await supabase.rpc("resolve_booking_cancellation",{p_booking_id:parsed.data.booking_id,p_cancel:parsed.data.operation==="approve_request",p_reason:parsed.data.reason});
  return result(error,"Cancellation decision recorded.");
}
