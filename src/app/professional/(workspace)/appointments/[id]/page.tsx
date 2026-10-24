import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { refreshProposals, requireData } from "@/lib/fulfillment/data";
import { uuid, indiaTime, statusLabel, money } from "@/lib/fulfillment/validation";
import { ActionForm } from "@/components/auth/action-form";
import { respondAssignment, advanceAppointment } from "@/app/professional/actions";

export default async function Appointment({ params }: { params: Promise<{ id:string }> }) {
  const { supabase,user }=await requireAccount("professional");
  const { id }=await params;
  if (!uuid.safeParse(id).success) notFound();
  await refreshProposals(supabase);
  const assignment=await supabase.from("booking_assignments").select("id,state,customer_terms_state,proposal_expires_at,offering_revision_id").eq("id",id).eq("professional_id",user.id).maybeSingle();
  if (assignment.error) throw new Error("Appointment unavailable.");
  if (!assignment.data) notFound();
  const a=assignment.data;
  const detail=requireData(await supabase.rpc("professional_assignment_details",{p_assignment_id:id}))[0];
  if (!detail) notFound();
  const address=detail.address_details && typeof detail.address_details==="object" && !Array.isArray(detail.address_details) ? detail.address_details : {};
  const revision=requireData(await supabase.from("professional_offering_revisions").select("title,price_minor,offering_type,total_sessions,package_duration_value,package_duration_unit").eq("id",a.offering_revision_id).single());
  return <><h1>{detail.service_name}</h1><p className="booking-status">{statusLabel(detail.state)}</p><p>{indiaTime(detail.starts_at)} – {indiaTime(detail.ends_at)} (India time)</p><p>Offering: {revision.title} ? {money(revision.price_minor)} {revision.offering_type === "recurring_package" ? "package total" : "per session"}</p>{revision.total_sessions && <p>{revision.total_sessions} sessions ? {revision.package_duration_value} {revision.package_duration_unit?.replaceAll("_", " ")}</p>}{detail.cancellation_requested && <p role="status">The customer requested cancellation. Await administrator resolution before proceeding.</p>}<section className="account-panel"><h2>{["accepted","in_progress"].includes(a.state) ? "Visit details" : "Service area"}</h2>{Object.entries(address).filter(([key,value]) => key!=="saved_address_id" && typeof value==="string" && value).map(([key,value]) => <p key={key}>{key.replaceAll("_"," ")}: {String(value)}</p>)}{!Object.keys(address).length && <p>Private visit details are unavailable for this appointment state.</p>}{detail.customer_notes && <p className="booking-notes">Customer note: {detail.customer_notes}</p>}</section>{a.state==="proposed" && <section className="account-panel"><h2>Respond to proposal</h2><p>Customer terms: {a.customer_terms_state}. Deadline: {indiaTime(a.proposal_expires_at)}.</p>{a.customer_terms_state!=="accepted" && <p>Acceptance is available after the customer agrees to the exact price, terms and schedule. You may decline now.</p>}<ActionForm action={respondAssignment} submit="Send response"><input name="assignment_id" type="hidden" value={id} /><label>Response<select name="response" defaultValue="decline">{a.customer_terms_state==="accepted" && <option value="accept">Accept and confirm</option>}<option value="decline">Decline proposal</option></select></label><label>Reason<textarea name="reason" required maxLength={1000} /></label><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />Confirm my response</label></ActionForm></section>}{["accepted","in_progress"].includes(a.state) && !detail.cancellation_requested && <section className="account-panel"><h2>Appointment progress</h2><p>Starting is permitted from the scheduled start. Completion requires an in-progress visit at or after the scheduled end.</p><ActionForm action={advanceAppointment} submit={a.state==="accepted" ? "Start appointment" : "Complete appointment"}><input type="hidden" name="assignment_id" value={id} /><input type="hidden" name="stage" value={a.state==="accepted" ? "in_progress" : "completed"} /><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />Confirm the actual visit progress</label></ActionForm></section>}</>;
}
