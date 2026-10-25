import type { Locality } from "@/lib/marketplace/contracts";
import { LocationMultiSelect } from "@/components/marketplace/location-select";
import type { Tables } from "@/lib/supabase/database.types";
import { ActionForm } from "@/components/auth/action-form";
import { saveApplication } from "@/app/professional/application-actions";

export function ApplicationFields({application,categories,defaultName="",defaultPhone="",localities=[]}:{application:(Tables<"professional_applications">&{requested_locality_ids?:string[]})|null;localities?:Locality[];categories:{id:string;name:string}[];defaultName?:string;defaultPhone?:string}){
  return <ActionForm action={saveApplication} submit="Save application draft">
    {application&&<><input type="hidden" name="application_id" value={application.id}/><input type="hidden" name="updated_at" value={application.updated_at}/></>}
    <p className="booking-help">You may save an incomplete draft. Before submission, complete every field except specializations, upload at least one credential and consent to review. Save your latest edits before submitting.</p>
    <fieldset className="form-section"><legend>About you</legend>
    <label>Full name<input name="full_name" autoComplete="name" maxLength={120} defaultValue={application?.full_name??defaultName}/></label>
    <label>Contact phone number<input name="phone" type="tel" autoComplete="tel" maxLength={20} defaultValue={application?.phone??defaultPhone}/></label>
    </fieldset><fieldset className="form-section"><legend>Your professional practice</legend>
    <label>Professional category<select name="category_id" defaultValue={application?.category_id??""}><option value="">Choose an Aara category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Relevant qualifications<textarea name="qualifications" maxLength={3000} defaultValue={application?.qualifications}/></label>
    <label>Years of experience<input name="years_experience" type="number" min={0} max={80} step="0.1" defaultValue={application?.years_experience??undefined}/></label>
    <label>Brief professional biography<textarea name="biography" maxLength={3000} defaultValue={application?.biography}/></label>
    <label>Specializations (optional)<textarea name="specializations" maxLength={1500} defaultValue={application?.specializations}/></label>
    </fieldset><fieldset className="form-section"><legend>Where you can visit</legend>
    <input type="hidden" name="service_locations" value={application?.service_locations??""}/><input type="hidden" name="postal_codes" value={application?.postal_codes.join(", ")??""}/>
    {localities.length>0&&<input type="hidden" name="use_locality_catalog" value="yes"/>}<LocationMultiSelect options={localities} defaultValues={application?.requested_locality_ids} help="Choose up to 20 Delhi localities where you would like to work, including areas not currently served. No PIN entry is needed. These are application preferences; bookable coverage requires separate administrator approval."/>
    {!localities.length&&<p className="booking-help">The locality catalog could not be loaded. Please refresh to try again. Existing saved location details are preserved.</p>}
    </fieldset>
  </ActionForm>;
}
