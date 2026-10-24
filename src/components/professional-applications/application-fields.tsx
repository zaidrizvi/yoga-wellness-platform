import type { Tables } from "@/lib/supabase/database.types";
import { ActionForm } from "@/components/auth/action-form";
import { saveApplication } from "@/app/professional/application-actions";

export function ApplicationFields({application,categories,defaultName="",defaultPhone=""}:{application:Tables<"professional_applications">|null;categories:{id:string;name:string}[];defaultName?:string;defaultPhone?:string}){
  return <ActionForm action={saveApplication} submit="Save application draft">
    {application&&<><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="updated_at" value={application.updated_at}/></>}
    <p className="booking-help">You may save an incomplete draft. Before submission, complete every field except specializations, upload at least one credential and consent to review. Save your latest edits before submitting.</p>
    <label>Full name<input name="full_name" autoComplete="name" maxLength={120} defaultValue={application?.full_name??defaultName}/></label>
    <label>Contact phone number<input name="phone" type="tel" autoComplete="tel" maxLength={20} defaultValue={application?.phone??defaultPhone}/></label>
    <label>Professional category<select name="category_id" defaultValue={application?.category_id??""}><option value="">Choose an Aara category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Relevant qualifications<textarea name="qualifications" maxLength={3000} defaultValue={application?.qualifications}/></label>
    <label>Years of experience<input name="years_experience" type="number" min={0} max={80} step="0.1" defaultValue={application?.years_experience??undefined}/></label>
    <label>Brief professional biography<textarea name="biography" maxLength={3000} defaultValue={application?.biography}/></label>
    <label>Specializations (optional)<textarea name="specializations" maxLength={1500} defaultValue={application?.specializations}/></label>
    <label>Delhi NCR service locations<textarea name="service_locations" maxLength={1000} defaultValue={application?.service_locations}/></label>
    <label>Service PIN codes<input name="postal_codes" inputMode="text" maxLength={200} defaultValue={application?.postal_codes.join(", ")}/><span className="booking-help">Up to 20 six-digit PINs, separated by commas or spaces. These are requested locations; application approval does not automatically authorize coverage.</span></label>
  </ActionForm>;
}
