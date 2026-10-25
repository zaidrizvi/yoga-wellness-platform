import { MarketplaceAudit } from "@/components/marketplace/audit";
import { requireAccount } from "@/lib/auth/session";
import { requireData } from "@/lib/fulfillment/data";
import { indiaTime } from "@/lib/fulfillment/validation";

export const metadata={title:"Review history | Aara"};
export default async function ReviewHistory(){
  const {supabase}=await requireAccount("admin");
  const [a,b,c]=await Promise.all([supabase.from("administrative_audit").select("*").order("created_at",{ascending:false}).limit(100),supabase.from("professional_offering_events").select("*").order("created_at",{ascending:false}).limit(100),supabase.from("booking_fulfillment_events").select("*").order("created_at",{ascending:false}).limit(100)]);
  const sections=[{title:"Professional verification & role decisions",rows:requireData(a).map(e=>({id:e.id,at:e.created_at,label:`${e.action}: ${e.previous_state??"new"} → ${e.new_state}`,target:e.target_user_id,actor:e.actor_user_id,reason:e.reason}))},{title:"Offering, price & coverage reviews",rows:requireData(b).map(e=>({id:e.id,at:e.created_at,label:e.event,target:e.professional_id,actor:e.actor_user_id,reason:e.reason}))},{title:"Booking & commercial agreement events",rows:requireData(c).map(e=>({id:e.id,at:e.created_at,label:`${e.event}: ${e.previous_state??"new"} → ${e.new_state}`,target:e.booking_id,actor:e.actor_user_id,reason:e.reason}))}];
  return <><h1>Review history.</h1><MarketplaceAudit/><p>Latest 100 events per category. Read-only audit records preserve authorization decisions and booking transitions.</p>{sections.map(s=><section key={s.title} className="account-panel"><h2>{s.title}</h2>{s.rows.length?<ul className="event-list">{s.rows.map(e=><li key={e.id}><p>{indiaTime(e.at)} · {e.label.replaceAll("_"," ")}</p><p className="booking-reference">Record {e.target} · actor {e.actor??"System / trusted operation"}</p>{e.reason&&<p>{e.reason}</p>}</li>)}</ul>:<p>No events recorded.</p>}</section>)}</>;
}
