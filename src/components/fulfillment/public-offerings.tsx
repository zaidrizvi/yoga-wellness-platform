import Link from "next/link";
import { publicOfferings } from "@/lib/data/public";
import { money } from "@/lib/fulfillment/validation";

export async function ApprovedOfferings({slug}:{slug:string}){
  const rows=await publicOfferings(slug);
  return <section className="shell account-shell"><p className="eyebrow">Reviewed professional offerings</p><h2>Care, with clear terms.</h2><p>Only approved offerings from currently eligible professionals appear here. Your request is reviewed for coverage and availability; you agree the final proposal before confirmation.</p>{!rows.length?<p>No approved professional offerings are available for this service yet. You may submit a service request for review; a request does not guarantee availability or a price.</p>:<div className="booking-grid">{rows.map(o=><article className="account-panel" key={o.offering_id}><h3>{o.title}</h3><p>By {o.display_name}</p><p>{o.description}</p><p className="offering-price">{money(o.price_minor)} {o.offering_type==="recurring_package"?"package total":"per session"}</p><p>{o.duration_minutes} minutes per session</p>{o.offering_type==="recurring_package"&&<p>{o.total_sessions} sessions{o.sessions_per_week?` · ${o.sessions_per_week} per week`:""} · {o.package_duration_value} {o.package_duration_unit?.replaceAll("_"," ")}</p>}{o.delivery_notes&&<p>{o.delivery_notes}</p>}<Link className="text-link" href={`/book/${slug}`}>Request this service</Link><p className="booking-help">No package purchase or payment is collected here.</p></article>)}</div>}</section>;
}
