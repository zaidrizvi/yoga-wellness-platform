import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { requireData } from "@/lib/fulfillment/data";
import { money,indiaTime } from "@/lib/fulfillment/validation";
import { ActionForm } from "@/components/auth/action-form";
import { reviewOffering,suspendOffering } from "../../fulfillment-actions";
export const metadata={title:"Services & prices | Aara"};
export default async function OfferingReviews(){
  const {supabase}=await requireAccount("admin");
  const [offeringResult,revisionResult,profileResult,verificationResult]=await Promise.all([
    supabase.from("professional_offerings").select("*,services(name)").order("updated_at",{ascending:false}),
    supabase.from("professional_offering_revisions").select("*").order("created_at",{ascending:false}),
    supabase.from("professional_profiles").select("user_id,display_name,qualifications_description,experience_description,specializations"),
    supabase.from("professional_verifications").select("professional_id,status"),
  ]);
  const offerings=requireData(offeringResult),revisions=requireData(revisionResult),profiles=requireData(profileResult),verification=requireData(verificationResult);
  return <><h1>Services & Prices</h1><p>Review trainer services, packages and prices.</p>{!offerings.length&&<p>No trainer services have been submitted.</p>}
    {offerings.map(offering=>{const profile=profiles.find(x=>x.user_id===offering.professional_id);const rows=revisions.filter(x=>x.offering_id===offering.id);return <article className="account-panel" key={offering.id}><h2>{profile?.display_name||"Trainer"} · {offering.services?.name}</h2><p>Trainer status: {verification.find(x=>x.professional_id===offering.professional_id)?.status??"Unavailable"}</p><Link href="/admin/professionals" className="text-link">View trainer</Link>
      {rows.map(revision=><details key={revision.id} open={revision.state==="submitted"}><summary>{revision.title} · {money(revision.price_minor)} · {revision.state}</summary><p>{revision.description}</p><p>{revision.duration_minutes} minutes{revision.total_sessions?` · ${revision.total_sessions} sessions`:""}</p>{revision.feedback&&<p>Feedback: {revision.feedback}</p>}{revision.reviewed_at&&<p>Reviewed {indiaTime(revision.reviewed_at)}</p>}
        {revision.state==="submitted"&&<ActionForm action={reviewOffering} submit="Save review"><input type="hidden" name="revision_id" value={revision.id}/><label>Decision<select name="decision" defaultValue="approve"><option value="approve">Approve</option><option value="reject">Request changes</option></select></label><label>Feedback<textarea name="feedback" required maxLength={1000}/></label><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>I reviewed the service, duration and price.</label></ActionForm>}</details>)}
      {offering.approved_revision_id&&<ActionForm action={suspendOffering} submit={offering.suspended?"Resume service":"Suspend service"}><input type="hidden" name="offering_id" value={offering.id}/><input type="hidden" name="suspended" value={offering.suspended?"false":"true"}/><label>Reason<textarea name="reason" required maxLength={1000}/></label><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>Confirm this change.</label></ActionForm>}</article>;})}</>;
}
