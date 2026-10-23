import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { refreshProposals,requireData } from "@/lib/fulfillment/data";
import { statusLabel,indiaTime } from "@/lib/fulfillment/validation";

export const metadata={title:"Booking requests | Aara"};
export default async function BookingQueue({searchParams}:{searchParams:Promise<{page?:string;status?:string}>}){
  const {supabase}=await requireAccount("admin");await refreshProposals(supabase);
  const query=await searchParams;const page=z.coerce.number().int().min(1).max(100000).catch(1).parse(query.page??1);
  const statuses=["pending","awaiting_customer_agreement","assignment_proposed","confirmed","in_progress","completed","cancelled","requires_rescheduling"];
  const status=statuses.includes(query.status??"")?query.status!:"";
  let request=supabase.from("booking_requests").select("id,service_name,status,preferred_date,time_window,created_at,cancellation_requested_at",{count:"exact"}).order("created_at",{ascending:false}).order("id");
  if(status) request=request.eq("status",status);
  const response=await request.range((page-1)*20,page*20-1);const bookings=requireData(response);
  return <><h1>Booking requests.</h1><p>Review genuine requests, agree exact terms with customers, then obtain professional acceptance. All appointments use India time.</p><form className="account-form" method="get"><label>Filter by status<select name="status" defaultValue={status}><option value="">All requests</option>{statuses.map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}</select></label><button className="text-link" type="submit">Apply filter</button></form>{!bookings.length&&<p>No requests match this view.</p>}<div className="booking-grid">{bookings.map(b=><article className="account-panel" key={b.id}><p className="booking-status">{statusLabel(b.status)}</p><h2>{b.service_name}</h2><p>Preference: {b.preferred_date} · {b.time_window}</p><p>Submitted {indiaTime(b.created_at)}</p>{b.cancellation_requested_at&&<p>Cancellation request needs review.</p>}<Link className="text-link" href={`/admin/bookings/${b.id}`}>Review & manage request</Link></article>)}</div><nav className="account-links" aria-label="Booking queue pages">{page>1&&<Link href={`/admin/bookings?page=${page-1}&status=${status}`}>Newer requests</Link>}{page*20<(response.count??0)&&<Link href={`/admin/bookings?page=${page+1}&status=${status}`}>Older requests</Link>}</nav></>;
}
