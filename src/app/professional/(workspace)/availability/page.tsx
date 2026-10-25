import { requireAccount } from "@/lib/auth/session";
import { refreshProposals, requireData } from "@/lib/fulfillment/data";
import { indiaTime } from "@/lib/fulfillment/validation";
import { ActionForm } from "@/components/auth/action-form";
import { ScheduleForm } from "@/components/fulfillment/schedule-form";
import { activeLocalities } from "@/lib/marketplace/data";
import { LocalityCoverage } from "@/components/marketplace/coverage";
import { saveTimeOff, deleteTimeOff, requestCoverage } from "@/app/professional/actions";

export const metadata = { title: "Availability & working areas | Aara" };
export default async function Availability() {
  const { supabase, user } = await requireAccount("professional");
  await refreshProposals(supabase);
  const [a,b,c,d,e,locations] = await Promise.all([
    supabase.from("professional_weekly_availability").select("*").eq("professional_id",user.id).order("iso_weekday").order("start_time"),
    supabase.from("professional_time_off").select("*").eq("professional_id",user.id).order("starts_at"),
    supabase.from("service_areas").select("id,name,postal_code").eq("is_active",true).not("postal_code","is",null).order("name"),
    supabase.from("professional_service_areas").select("service_area_id,service_areas(name,postal_code)").eq("professional_id",user.id),
    supabase.from("professional_coverage_requests").select("*,service_areas(name,postal_code)").eq("professional_id",user.id).order("created_at",{ascending:false}),
    activeLocalities(),
  ]);
  requireData(c);
  const windows=requireData(a), timeOff=requireData(b),  approved=requireData(d), requests=requireData(e);
  return <><h1>Your working rhythm.</h1><p>Only saved weekly hours and approved PIN coverage are used for booking eligibility. Schedule changes cannot override reserved or confirmed appointments.</p><section className="account-panel"><h2>Weekly availability</h2><ScheduleForm key={JSON.stringify(windows)} windows={windows} /></section><section className="account-panel"><h2>Time off</h2><ActionForm action={saveTimeOff} submit="Add time off"><label>From (India time)<input type="datetime-local" name="starts_at" required /></label><label>Until (India time)<input type="datetime-local" name="ends_at" required /></label><label>Reason (private)<textarea name="reason" maxLength={500} /></label></ActionForm>{!timeOff.length && <p>No time-off exceptions saved.</p>}{timeOff.map(t => <details key={t.id}><summary>{indiaTime(t.starts_at)} – {indiaTime(t.ends_at)}</summary><p>{t.reason}</p><ActionForm action={deleteTimeOff} submit="Remove time off"><input type="hidden" name="id" value={t.id} /><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />Confirm removal</label></ActionForm></details>)}</section><section className="account-panel"><h2>Working areas</h2><h3>Administrator-approved coverage</h3>{approved.length ? <ul>{approved.map(a => <li key={a.service_area_id}>{a.service_areas?.name} · PIN {a.service_areas?.postal_code ?? "Not configured; unavailable for assignment"}</li>)}</ul> : <p>No approved working areas yet.</p>}<LocalityCoverage localities={locations.localities} approved={approved.map(a=>a.service_area_id)} requests={requests}/>{!locations.available&&<p role="status">Named-locality requests await Phase 4E deployment. Existing approved coverage and requests are preserved.</p>}{approved.length>0&&<ActionForm action={requestCoverage} submit="Request removal of approved coverage"><label>Approved working area<select name="service_area_id" required>{approved.map(a=><option key={a.service_area_id} value={a.service_area_id}>{a.service_areas?.name}</option>)}</select></label><input type="hidden" name="operation" value="remove"/></ActionForm>}<h3>Coverage review requests</h3>{requests.length ? <ul>{requests.map(r => <li key={r.id}>{r.service_areas?.name} · {r.action} · {r.state}{r.feedback && ` — ${r.feedback}`}</li>)}</ul> : <p>No coverage requests submitted.</p>}</section></>;
}
