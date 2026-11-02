import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { catalogLocalities } from "@/lib/marketplace/data";
import { marketplacePending,marketplaceRpc } from "@/lib/marketplace/rpc";
import { LocationMultiSelect } from "@/components/marketplace/location-select";
import { ActionForm } from "@/components/auth/action-form";
import { requestLocations } from "./actions";
const place=z.object({id:z.uuid(),name:z.string(),district:z.string()});
const overview=z.object({approved:z.array(place),requests:z.array(z.object({id:z.uuid(),locality_id:z.uuid(),name:z.string(),district:z.string(),action:z.string(),state:z.string(),feedback:z.string(),created_at:z.string()}))});
export const metadata={title:"My locations | Aara"};
export default async function Locations(){
  const {supabase}=await requireAccount("professional");
  const [catalog,result]=await Promise.all([catalogLocalities(),marketplaceRpc(supabase,"professional_locality_overview")]);
  if(result.error&&marketplacePending(result.error))return <><h1>My Locations</h1><p>Location management requires the pending locality-first database migration.</p></>;
  if(result.error)throw new Error("Professional locations are temporarily unavailable.");
  const data=overview.parse(result.data);const unavailable=new Set([...data.approved.map(x=>x.id),...data.requests.filter(x=>x.state==="submitted").map(x=>x.locality_id)]);
  return <><h1>My Locations</h1><section className="account-panel"><h2>Approved</h2>{data.approved.length?<ul>{data.approved.map(x=><li key={x.id}>{x.name} · {x.district}</li>)}</ul>:<p>No approved locations yet.</p>}</section>
    <section className="account-panel"><h2>Requests</h2>{data.requests.length?<ul className="event-list">{data.requests.map(x=><li key={x.id}>{x.name} · {x.state}{x.feedback&&` — ${x.feedback}`}</li>)}</ul>:<p>No additional-location requests.</p>}</section>
    <section className="account-panel"><h2>Request More Locations</h2><ActionForm action={requestLocations} submit="Submit request"><LocationMultiSelect options={catalog.localities.filter(x=>!unavailable.has(x.id))} help="Choose new Delhi localities. Existing approved locations stay unchanged."/><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>Submit these locations for administrator review.</label></ActionForm></section></>;
}
