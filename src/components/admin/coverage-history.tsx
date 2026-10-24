import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { operationsRpc } from "@/lib/admin-operations/rpc";
import { indiaTime } from "@/lib/fulfillment/validation";
export async function CoverageHistory({client}:{client:SupabaseClient<Database>}){
  const {data,error}=await operationsRpc(client,"admin_coverage_history");
  if(error)throw new Error("Coverage history is temporarily unavailable.");
  const details=z.object({name:z.string(),postal_code:z.string().nullable(),is_active:z.boolean()});
  const rows=z.array(z.object({id:z.string(),service_area_id:z.string(),actor_user_id:z.string().nullable(),reason:z.string(),created_at:z.string(),previous_details:details.nullable(),new_details:details})).parse(data);
  return <section className="account-panel"><h2>Recent coverage decisions</h2>{rows.length?<ul className="event-list">{rows.map(r=><li key={r.id}>{indiaTime(r.created_at)} · {r.new_details.name} / {r.new_details.postal_code} · {r.previous_details?"Updated":"Created"} · {r.new_details.is_active?"Active":"Inactive"}<p>{r.reason}</p><p className="booking-reference">Area {r.service_area_id} · actor {r.actor_user_id??"Trusted maintenance"}</p></li>)}</ul>:<p>No coverage decisions recorded.</p>}<p>Latest 30 records.</p></section>;
}
