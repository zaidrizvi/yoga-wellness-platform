import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { refreshProposals,requireData } from "@/lib/fulfillment/data";
import { indiaTime,statusLabel } from "@/lib/fulfillment/validation";
import { marketplacePending,marketplaceRpc } from "@/lib/marketplace/rpc";

export const metadata={title:"Professional dashboard | Aara"};
export default async function ProfessionalDashboard(){
  const {supabase,user}=await requireAccount("professional");await refreshProposals(supabase);
  const now=new Date().toISOString();
  const [a,b,c,d,e,localities]=await Promise.all([
    supabase.from("professional_profiles").select("display_name,public_visible").eq("user_id",user.id).single(),
    supabase.rpc("own_professional_verification"),
    supabase.from("professional_offerings").select("id,approved_revision_id,suspended").eq("professional_id",user.id),
    supabase.from("professional_offering_revisions").select("id,state"),
    supabase.from("booking_assignments").select("id,state,starts_at,ends_at,customer_terms_state").eq("professional_id",user.id).in("state",["proposed","accepted","in_progress"]).order("starts_at"),
    marketplaceRpc(supabase,"professional_locality_overview"),
  ]);
  if(localities.error&&!marketplacePending(localities.error))throw new Error("Your approved locations are temporarily unavailable.");
  const profile=requireData(a),verification=requireData(b)[0],offerings=requireData(c),revisions=requireData(d),assignments=requireData(e);
  const upcoming=assignments.filter(a=>Date.parse(a.ends_at)>=Date.parse(now)||a.state==="in_progress");
  const pending=revisions.filter(r=>r.state==="submitted").length;
  const needingResponse=assignments.filter(a=>a.state==="proposed"&&a.customer_terms_state==="accepted").length;
  const approvedLocalities=localities.error?null:Array.isArray(localities.data)?localities.data.filter(row=>row&&typeof row==="object"&&"request_state" in row&&row.request_state==="approved").length:0;
  return <><p className="eyebrow">A little clarity for your working day</p><h1>{profile.display_name?`Welcome, ${profile.display_name}.`:"Your professional workspace."}</h1><p>Manage your practice with clear terms, reviewed offerings and a schedule that works for you.</p><div className="workspace-metrics"><article><h2>Verification</h2><p>{verification?.status??"Unavailable"}</p><span>{profile.public_visible?"Profile set to public while eligible":"Profile not public"}</span></article><article><h2>Approved locations</h2><p>{approvedLocalities??"—"}</p><span><Link href="/professional/locations">View Delhi locations</Link></span></article><article><h2>Approved offerings</h2><p>{offerings.filter(o=>o.approved_revision_id).length}</p><span>{offerings.filter(o=>o.suspended).length} suspended</span></article><article><h2>Awaiting review</h2><p>{pending}</p><span>Saved offering revisions submitted</span></article><article><h2>Upcoming / active</h2><p>{upcoming.length}</p><span>Reservations and accepted visits</span></article></div><section className="account-panel"><h2>Items requiring attention</h2><ul className="event-list">{needingResponse>0&&<li><Link href="/professional/appointments">Respond to {needingResponse} customer-agreed proposal{needingResponse===1?"":"s"}</Link></li>}{revisions.some(r=>r.state==="rejected")&&<li><Link href="/professional/services#approval-status">Review feedback on rejected offerings</Link></li>}{!offerings.length&&<li><Link href="/professional/services">Create your first service or Yoga package for review</Link></li>}{verification?.status!=="verified"&&<li><Link href="/account/professional">Review your profile status before accepting work</Link></li>}<li><Link href="/professional/availability">Keep weekly hours, time off and approved working areas current</Link></li></ul></section><section className="account-panel"><h2>Your next appointments</h2>{upcoming.length?<div className="booking-grid">{upcoming.slice(0,6).map(a=><article key={a.id}><p className="booking-status">{statusLabel(a.state)}</p><h3>{indiaTime(a.starts_at)}</h3><p>Until {indiaTime(a.ends_at)} (India time)</p><Link className="text-link" href={`/professional/appointments/${a.id}`}>Review appointment</Link></article>)}</div>:<p>No upcoming appointments are assigned. An approved profile and offering do not guarantee appointments.</p>}<Link className="text-link" href="/professional/appointments">View all appointments</Link></section><nav className="account-links" aria-label="Professional account support"><Link href="/professional/application-status">Application & submitted credentials</Link><Link href="/account/professional">My Profile & Credentials</Link><Link href="/account">Account Settings</Link></nav></>;
}
