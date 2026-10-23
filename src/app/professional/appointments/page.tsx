import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { refreshProposals, requireData } from "@/lib/fulfillment/data";
import { indiaTime, statusLabel } from "@/lib/fulfillment/validation";

export const metadata = { title: "My appointments | Aara" };
export default async function Appointments() {
  const { supabase,user }=await requireAccount("professional");
  await refreshProposals(supabase);
  const rows=requireData(await supabase.from("booking_assignments").select("id,booking_id,state,starts_at,ends_at,customer_terms_state,proposal_expires_at").eq("professional_id",user.id).order("starts_at",{ascending:false}).limit(100));
  return <><h1>Your appointments.</h1><p>Customer agreement comes first. Accept an agreed proposal to confirm the appointment. All times below are India time.</p>{!rows.length && <section className="account-panel"><h2>No assignments yet.</h2><p>Keep your approved offerings, working areas and availability up to date.</p><Link href="/professional/availability" className="text-link">Manage availability</Link></section>}<div className="booking-grid">{rows.map(a => <article className="account-panel" key={a.id}><p className="booking-status">{statusLabel(a.state)}</p><h2>{indiaTime(a.starts_at)}</h2><p>Until {indiaTime(a.ends_at)}</p>{a.state==="proposed" && <p>Customer terms: {a.customer_terms_state}. Response deadline: {indiaTime(a.proposal_expires_at)}</p>}<Link className="text-link" href={`/professional/appointments/${a.id}`}>Review appointment</Link></article>)}</div>{rows.length===100 && <p>Showing the latest 100 appointments by scheduled date.</p>}</>;
}
