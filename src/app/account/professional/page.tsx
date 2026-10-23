import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { saveProfessional } from "../actions";

export const metadata = { title: "Professional profile | Aara" };
export default async function ProfessionalPage() {
  const { supabase, user } = await requireAccount("professional");
  const [profileResult, statusResult, servicesResult] = await Promise.all([
    supabase.from("professional_profiles").select("display_name,biography,qualifications_description,experience_description").eq("user_id", user.id).single(),
    supabase.rpc("own_professional_verification"),
    supabase.from("professional_services").select("service_id,services(name)").eq("professional_id", user.id),
  ]);
  if (profileResult.error || statusResult.error || servicesResult.error) throw new Error("Professional information is temporarily unavailable.");
  const profile = profileResult.data;
  const status = statusResult.data[0];
  const editable = status?.status === "pending" || status?.status === "rejected";
  return <><p className="eyebrow">Your professional information</p><h1>Your practice.</h1><p>Verification: {status?.status ?? "Unavailable"}</p>{status?.reviewed_at && <p>Reviewed {new Date(status.reviewed_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}{!editable && <p>Profile edits are locked. Contact the administrator to reopen review.</p>}<ActionForm action={saveProfessional}><fieldset disabled={!editable}><label>Display name<input name="display_name" defaultValue={profile.display_name} required maxLength={120} /></label><label>Biography<textarea name="biography" defaultValue={profile.biography} maxLength={3000} /></label><label>Qualifications description<textarea name="qualifications_description" defaultValue={profile.qualifications_description} maxLength={3000} /></label><label>Experience description<textarea name="experience_description" defaultValue={profile.experience_description} maxLength={1500} /></label></fieldset></ActionForm><h2>Approved service associations</h2>{servicesResult.data.length ? <ul>{servicesResult.data.map(s => <li key={s.service_id}>{s.services?.name ?? "Service details currently unavailable"}</li>)}</ul> : <p>No approved service associations yet.</p>}</>;
}
