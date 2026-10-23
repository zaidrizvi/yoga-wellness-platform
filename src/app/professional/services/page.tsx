import { requireAccount } from "@/lib/auth/session";
import { requireData } from "@/lib/fulfillment/data";
import { money, indiaTime } from "@/lib/fulfillment/validation";
import { OfferingForm } from "@/components/fulfillment/offering-form";
import { ActionForm } from "@/components/auth/action-form";
import { submitOffering } from "../actions";

export const metadata = { title: "My services & packages | Aara" };
export default async function MyServices({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { supabase, user } = await requireAccount("professional");
  const kind = (await searchParams).kind === "recurring_package" ? "recurring_package" : "single_session";
  const [a,b,c,d] = await Promise.all([
    supabase.from("professional_offerings").select("*").eq("professional_id", user.id).order("created_at", { ascending: false }),
    supabase.from("professional_offering_revisions").select("*").order("revision_number", { ascending: false }),
    supabase.from("services").select("id,name,service_categories!inner(slug,is_active)").eq("is_active", true).eq("is_published", true).eq("service_categories.is_active", true),
    supabase.from("professional_offering_events").select("id,event,reason,created_at").eq("professional_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);
  const offerings = requireData(a), revisions = requireData(b), events = requireData(d);
  const services = requireData(c).map(s => ({ id: s.id, name: s.name, yoga: s.service_categories.slug === "yoga" }));
  const newServices = kind === "recurring_package" ? services.filter(s => s.yoga) : services;
  return <><h1>{kind === "recurring_package" ? "Your Yoga packages." : "Your services."}</h1><p>Create genuine offerings with your own prices. Administrator review is required before publication. Existing approved terms stay visible while a revision is reviewed.</p><details className="account-panel" open={!offerings.length}><summary>Create {kind === "recurring_package" ? "a Yoga package" : "a service offering"}</summary><OfferingForm services={newServices} initialKind={kind} /></details><section id="approval-status"><h2>Approval status & revisions</h2>{!offerings.length && <p>You have no offerings yet. Save a draft above to begin.</p>}{offerings.map(o => {
    const rows = revisions.filter(r => r.offering_id === o.id);
    const working = rows.find(r => ["draft", "submitted", "rejected"].includes(r.state));
    const approved = rows.find(r => r.id === o.approved_revision_id);
    return <article className="account-panel" key={o.id}><h3>{approved?.title ?? working?.title ?? "Offering"}</h3><p>{services.find(s => s.id === o.service_id)?.name ?? "Service currently unavailable"} · {o.suspended ? "Suspended by administrator" : approved ? "Approved version available while eligible" : "Not yet public"}</p>{approved && <p>Current approved price: {money(approved.price_minor)} · revision {approved.revision_number}</p>}{rows.map(r => <details key={r.id}><summary>Revision {r.revision_number}: {r.state} · {money(r.price_minor)}</summary><p>{r.description}</p><p>{r.duration_minutes} minutes per session{r.offering_type === "recurring_package" ? ` · ${r.total_sessions} sessions · ${r.sessions_per_week ?? "Flexible"} per week · ${r.package_duration_value} ${r.package_duration_unit?.replaceAll("_", " ")}` : ""}</p>{r.feedback && <p>Administrator feedback: {r.feedback}</p>}{r.reviewed_at && <p>Reviewed {indiaTime(r.reviewed_at)}</p>}{r.state === "submitted" && <p>This revision is under review. Editing is locked until the decision.</p>}{["draft", "rejected"].includes(r.state) && <><OfferingForm key={r.updated_at} services={services} offering={o} revision={r} /><ActionForm action={submitOffering} submit="Submit saved revision"><input type="hidden" name="revision_id" value={r.id} /><input type="hidden" name="updated_at" value={r.updated_at} /><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />I have saved and reviewed this revision’s price and terms.</label></ActionForm></>}</details>)}{!working && <details><summary>Propose a new price / terms revision</summary><OfferingForm services={services} offering={o} initialKind={approved?.offering_type} baseline={approved} /></details>}</article>;
  })}</section><section className="account-panel"><h2>Recent review activity</h2>{events.length ? <ul className="event-list">{events.map(e => <li key={e.id}>{indiaTime(e.created_at)} · {e.event.replaceAll("_", " ")}{e.reason && ` — ${e.reason}`}</li>)}</ul> : <p>No review activity yet.</p>}</section></>;
}
