import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database,Tables } from "@/lib/supabase/database.types";
import { operationsRpc,migrationUnavailable } from "@/lib/admin-operations/rpc";
import { milestoneLabels } from "@/lib/admin-operations/contracts";
import { indiaTime,statusLabel } from "@/lib/fulfillment/validation";
export async function CustomerHistory({client,booking,agreedAt}:{client:SupabaseClient<Database>;booking:Tables<"booking_requests">;agreedAt?:string|null}){
  const result=await operationsRpc(client,"customer_booking_timeline",{p_booking_id:booking.id});
  if(result.error&&!migrationUnavailable(result.error))throw new Error("Booking milestones are temporarily unavailable.");
  const rows=result.error?null:z.array(z.object({event_id:z.uuid(),event_key:z.string().refine(k=>Object.hasOwn(milestoneLabels,k)),occurred_at:z.string()})).parse(result.data);
  return <section className="account-panel"><h2>Request history</h2><ul className="event-list">{rows?rows.map(e=><li key={e.event_id}>{indiaTime(e.occurred_at)} · {milestoneLabels[e.event_key]}</li>):<><li>Submitted {indiaTime(booking.created_at)} with your original service, address and preference.</li>{agreedAt&&<li>Terms agreed {indiaTime(agreedAt)}.</li>}{booking.cancelled_at&&<li>Cancelled {indiaTime(booking.cancelled_at)}.</li>}</>}<li>Current status: {statusLabel(booking.status)}.</li></ul>{!rows&&<p className="booking-help">Detailed milestone history is not available yet. Your request and agreed terms remain recorded.</p>}</section>;
}
