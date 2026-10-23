"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import type { FormState } from "@/lib/auth/validation";

export async function reviewProfessional(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("admin");
  const parsed = z.object({ target: z.uuid(), status: z.enum(["pending", "verified", "rejected", "suspended"]), notes: z.string().trim().max(4000), reason: z.string().trim().min(1).max(4000), confirmed: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Choose a valid status, provide a reason, and confirm the decision." };
  // Preserve the existing approved image reference; this milestone has no image publisher.
  const { data: profile, error: readError } = await supabase.from("professional_profiles").select("approved_image_reference").eq("user_id", parsed.data.target).single();
  if (readError || !profile) return { error: "Professional information could not be loaded." };
  const { error } = await supabase.rpc("review_professional", { target_user: parsed.data.target, new_status: parsed.data.status, make_public: parsed.data.status === "verified" && form.get("public_visible") === "yes", new_internal_notes: parsed.data.notes, new_image_reference: profile.approved_image_reference ?? undefined, reason: parsed.data.reason });
  if (error) return { error: "Review could not be saved. Check your current permissions and retry." };
  revalidatePath("/admin/professionals"); revalidatePath("/professionals"); revalidatePath("/account/professional");
  return { success: "Professional review saved and public visibility updated." };
}

export async function publishService(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("admin");
  const parsed = z.object({ id: z.uuid(), published: z.enum(["true", "false"]), confirmed: z.literal("yes") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Confirm the publication change before saving." };
  const { data, error } = await supabase.from("services").update({ is_published: parsed.data.published === "true" }).eq("id", parsed.data.id).select("slug").single();
  if (error || !data) return { error: "Publication could not be changed. Inactive services cannot be published." };
  revalidatePath("/"); revalidatePath("/services"); revalidatePath(`/services/${data.slug}`); revalidatePath("/sitemap.xml"); revalidatePath("/admin/services");
  return { success: parsed.data.published === "true" ? "Service published." : "Service unpublished." };
}

export async function openDocument(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("admin");
  const owner = z.uuid().safeParse(form.get("owner"));
  const filename = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$/).safeParse(form.get("filename"));
  if (!owner.success || !filename.success) return { error: "Invalid document request." };
  const profile = await supabase.from("professional_profiles").select("user_id").eq("user_id", owner.data).single();
  if (profile.error || !profile.data) return { error: "Professional not found." };
  const storage = supabase.storage.from("professional-documents");
  const { data: objects, error: listError } = await storage.list(owner.data, { search: filename.data, limit: 100 });
  if (listError || !objects?.some(object => object.name === filename.data && object.id)) return { error: "Document is unavailable or access was denied." };
  const { data, error } = await storage.createSignedUrl(`${owner.data}/${filename.data}`, 60);
  return error || !data ? { error: "Unable to open this document." } : { url: data.signedUrl, success: "Private link expires in 60 seconds." };
}
