"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/validation";
import { uuid, offeringInput, reason, indiaInstant, weeklyWindow, decision } from "@/lib/fulfillment/validation";
import { result } from "@/lib/fulfillment/action-result";
import { marketplaceRpc } from "@/lib/marketplace/rpc";

export async function saveOffering(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const parsed = offeringInput.safeParse(Object.fromEntries(form));
  const ids = z.object({ offering_id: uuid.optional(), revision_id: uuid.optional(), updated_at: z.iso.datetime({ offset: true }).optional() }).safeParse({ offering_id: form.get("offering_id") || undefined, revision_id: form.get("revision_id") || undefined, updated_at: form.get("updated_at") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the offering details." };
  if (!ids.success) return { error: "Reload this revision before saving." };
  const { service_id, price, ...terms } = parsed.data;
  const { error } = await supabase.rpc("save_professional_offering", { p_service_id: service_id, p_terms: { ...terms, price_minor: price }, p_offering_id: ids.data.offering_id, p_revision_id: ids.data.revision_id, p_expected_updated_at: ids.data.updated_at });
  return result(error, "Draft saved. Submit the saved revision below when ready for review.");
}
export async function submitOffering(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const parsed = z.object({ revision_id: uuid, updated_at: z.iso.datetime({ offset: true }), confirmed: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Confirm submission of the current saved revision." };
  const { error } = await supabase.rpc("submit_professional_offering", { p_revision_id: parsed.data.revision_id, p_expected_updated_at: parsed.data.updated_at });
  return result(error, "Submitted for administrator review. Unapproved terms are not public.");
}
export async function saveSchedule(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const days = form.getAll("weekday"), starts = form.getAll("start"), ends = form.getAll("end");
  if (form.get("confirmed") !== "yes" || days.length !== starts.length || days.length !== ends.length) return { error: "Confirm replacement of your weekly schedule." };
  const parsed = z.array(weeklyWindow).max(28).safeParse(days.map((day, i) => ({ iso_weekday: day, start_time: starts[i], end_time: ends[i] })));
  if (!parsed.success) return { error: "Use up to 28 valid working windows; each end must follow its start." };
  const { error } = await supabase.rpc("save_weekly_availability", { p_windows: parsed.data });
  return result(error, "Weekly availability saved in India time.");
}
export async function saveTimeOff(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const parsed = z.object({ starts_at: indiaInstant, ends_at: indiaInstant, reason: z.string().trim().max(500), id: uuid.optional() }).safeParse({ ...Object.fromEntries(form), id: form.get("id") || undefined });
  if (!parsed.success || Date.parse(parsed.data.ends_at) <= Date.parse(parsed.data.starts_at)) return { error: "Choose a valid time-off interval in India time." };
  const { error } = await supabase.rpc("save_professional_time_off", { p_starts_at: parsed.data.starts_at, p_ends_at: parsed.data.ends_at, p_reason: parsed.data.reason, p_id: parsed.data.id });
  return result(error, "Time off saved.");
}
export async function deleteTimeOff(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const id = uuid.safeParse(form.get("id"));
  if (!id.success || form.get("confirmed") !== "yes") return { error: "Confirm removal of this time-off exception." };
  const { error } = await supabase.rpc("delete_professional_time_off", { p_id: id.data });
  return result(error, "Time-off exception removed.");
}
export async function requestCoverage(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const parsed = z.object({ service_area_id: uuid, operation: z.enum(["add", "remove"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Choose an existing configured working area and operation." };
  const { error } = await supabase.rpc("request_professional_coverage", { p_service_area_id: parsed.data.service_area_id, p_remove: parsed.data.operation === "remove" });
  return result(error, "Coverage request submitted for administrator review.");
}
export async function respondAssignment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const parsed = z.object({ assignment_id: uuid, response: decision, reason: reason, confirmed: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Select a response, give a reason and confirm." };
  const { data, error } = await supabase.rpc("respond_booking_assignment", { p_assignment_id: parsed.data.assignment_id, p_accept: parsed.data.response === "accept", p_reason: parsed.data.reason });
  const outcome = data && typeof data === "object" && !Array.isArray(data) ? data.outcome : undefined;
  return result(error, outcome === "expired" ? "The proposal expired. No appointment was confirmed." : parsed.data.response === "accept" ? "Appointment accepted and confirmed." : "Proposal declined. The reservation has been released.");
}
export async function advanceAppointment(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("professional");
  const parsed = z.object({ assignment_id: uuid, stage: z.enum(["in_progress", "completed"]), confirmed: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Confirm the appointment state change." };
  const { error } = await supabase.rpc("advance_booking_appointment", { p_assignment_id: parsed.data.assignment_id, p_stage: parsed.data.stage });
  return result(error, parsed.data.stage === "completed" ? "Appointment marked completed." : "Appointment marked in progress.");
}
export async function uploadCredential(_: FormState, form: FormData): Promise<FormState> {
  const { supabase, user } = await requireAccount("professional");
  const file = form.get("document");
  if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) return { error: "Choose a PDF, JPEG or PNG file, up to 10 MB." };
  const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const kind = signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46 ? { ext: "pdf", mime: "application/pdf" } : signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff ? { ext: "jpg", mime: "image/jpeg" } : [137,80,78,71,13,10,26,10].every((v,i) => signature[i] === v) ? { ext: "png", mime: "image/png" } : null;
  if (!kind || file.type !== kind.mime) return { error: "The file contents must match a supported PDF, JPEG or PNG type." };
  const { error } = await supabase.storage.from("professional-documents").upload(`${user.id}/${crypto.randomUUID()}.${kind.ext}`, file, { contentType: kind.mime, upsert: false });
  return result(error, "Private credential uploaded for administrator review. This does not change your verification status.");
}

export async function uploadProfilePhoto(_: FormState, form: FormData): Promise<FormState> {
  const {supabase,user}=await requireAccount("professional");
  const file=form.get("photo");
  if(!(file instanceof File)||!file.size||file.size>5*1024*1024)return {error:"Choose a JPEG, PNG or WebP image up to 5 MB."};
  const signature=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const kind=signature[0]===0xff&&signature[1]===0xd8&&signature[2]===0xff?{ext:"jpg",mime:"image/jpeg"}:
    [137,80,78,71,13,10,26,10].every((value,index)=>signature[index]===value)?{ext:"png",mime:"image/png"}:
    signature[0]===0x52&&signature[1]===0x49&&signature[2]===0x46&&signature[3]===0x46&&signature[8]===0x57&&signature[9]===0x45&&signature[10]===0x42&&signature[11]===0x50?{ext:"webp",mime:"image/webp"}:null;
  if(!kind||file.type!==kind.mime)return {error:"The file contents must match a JPEG, PNG or WebP image."};
  const path=`${user.id}/${crypto.randomUUID()}.${kind.ext}`;
  const storage=supabase.storage.from("public-professional-images");
  const uploaded=await storage.upload(path,file,{contentType:kind.mime,upsert:false,cacheControl:"3600"});
  if(uploaded.error)return {error:"Your photo could not be uploaded. Please try again."};
  const reference=`public-professional-images/${path}`;
  const attached=await marketplaceRpc(supabase,"set_professional_profile_photo",{p_reference:reference});
  if(attached.error){await storage.remove([path]);return {error:"Your photo was uploaded but could not be attached to your profile."};}
  if(typeof attached.data==="string"&&attached.data.startsWith("public-professional-images/"))await storage.remove([attached.data.slice("public-professional-images/".length)]);
  revalidatePath("/account/professional");revalidatePath("/professional");revalidatePath("/professionals");revalidatePath("/");
  return {success:"Profile photo updated. It is visible whenever your trainer profile is published."};
}

export async function removeProfilePhoto(_: FormState, form: FormData): Promise<FormState> {
  if(form.get("confirmed")!=="yes")return {error:"Confirm removal of your profile photo."};
  const {supabase}=await requireAccount("professional");
  const detached=await marketplaceRpc(supabase,"set_professional_profile_photo",{p_reference:null});
  if(detached.error)return {error:"Your profile photo could not be removed."};
  if(typeof detached.data==="string"&&detached.data.startsWith("public-professional-images/"))await supabase.storage.from("public-professional-images").remove([detached.data.slice("public-professional-images/".length)]);
  revalidatePath("/account/professional");revalidatePath("/professional");revalidatePath("/professionals");revalidatePath("/");
  return {success:"Profile photo removed."};
}

export async function openOwnCredential(_: FormState, form: FormData): Promise<FormState> {
  const {supabase,user}=await requireAccount("professional");
  const filename=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$/).safeParse(form.get("filename"));
  if(!filename.success)return {error:"Invalid document reference."};
  const {data,error}=await supabase.storage.from("professional-documents").createSignedUrl(`${user.id}/${filename.data}`,60);
  return error||!data?{error:"The private document is unavailable."}:{url:data.signedUrl,success:"Private link expires in 60 seconds."};
}
