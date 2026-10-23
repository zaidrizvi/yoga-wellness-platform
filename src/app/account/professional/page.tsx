import { requireAccount } from "@/lib/auth/session";
import { requireData } from "@/lib/fulfillment/data";
import { ActionForm } from "@/components/auth/action-form";
import { saveProfessional } from "../actions";
import { uploadCredential,openOwnCredential } from "@/app/professional/actions";

export const metadata = { title: "Professional profile | Aara" };
export default async function ProfessionalPage() {
  const { supabase,user }=await requireAccount("professional");
  const [a,b,c]=await Promise.all([
    supabase.from("professional_profiles").select("display_name,biography,qualifications_description,experience_description,specializations").eq("user_id",user.id).single(),
    supabase.rpc("own_professional_verification"),
    supabase.storage.from("professional-documents").list(user.id,{limit:100}),
  ]);
  const profile=requireData(a),status=requireData(b)[0],editable=status?.status==="pending"||status?.status==="rejected";
  return <><p className="eyebrow">Your professional information</p><h1>Your practice.</h1><p>Verification: {status?.status??"Unavailable"}</p>{editable?<ActionForm action={saveProfessional}><label>Display name<input name="display_name" defaultValue={profile.display_name} required maxLength={120}/></label><label>Biography<textarea name="biography" defaultValue={profile.biography} maxLength={3000}/></label><label>Qualifications<textarea name="qualifications_description" defaultValue={profile.qualifications_description} maxLength={3000}/></label><label>Experience<textarea name="experience_description" defaultValue={profile.experience_description} maxLength={1500}/></label><label>Specializations<textarea name="specializations" defaultValue={profile.specializations} maxLength={1500}/></label><p className="booking-help">Your new claims are not treated as verified until administrator review.</p></ActionForm>:<section className="account-panel"><p>Material edits are locked for verified or suspended profiles. Ask an administrator to reopen review before changing qualifications or other claims.</p><h2>{profile.display_name}</h2><p>{profile.biography}</p><p>Qualifications: {profile.qualifications_description||"Not supplied"}</p><p>Experience: {profile.experience_description||"Not supplied"}</p><p>Specializations: {profile.specializations||"Not supplied"}</p></section>}<section className="account-panel"><h2>Private credentials</h2><p>PDF, JPEG or PNG, up to 10 MB. Documents remain private to you and authorized administrators. Uploading does not approve new qualifications.</p><ActionForm action={uploadCredential} submit="Upload private credential"><label>Credential document<input type="file" name="document" accept="application/pdf,image/jpeg,image/png" required/></label></ActionForm>{c.error?<p>Documents could not be loaded. Try again before resubmitting a file.</p>:!c.data?.some(d=>d.id)?<p>No credentials uploaded yet.</p>:c.data.filter(d=>d.id).map((d,i)=><ActionForm key={d.id} action={openOwnCredential} submit={`Open private credential ${i+1}`}><input type="hidden" name="filename" value={d.name}/></ActionForm>)}</section></>;
}
