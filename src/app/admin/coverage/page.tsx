import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { marketplacePending,marketplaceRpc } from "@/lib/marketplace/rpc";
import { ActionForm } from "@/components/auth/action-form";
import { reviewLocalityRequest } from "@/app/admin/fulfillment-actions";
const request=z.object({id:z.uuid(),professional_id:z.uuid(),professional_name:z.string(),locality_id:z.uuid(),locality_name:z.string(),district:z.string(),action:z.string(),state:z.string(),created_at:z.string()});
export const metadata={title:"Locations | Aara"};
export default async function Locations(){
  const {supabase}=await requireAccount("admin");const response=await marketplaceRpc(supabase,"admin_professional_locality_requests");
  if(response.error&&marketplacePending(response.error))return <><h1>Locations</h1><p>The locality-first migration must be deployed before location requests can be reviewed.</p></>;
  if(response.error)throw new Error("Location requests are temporarily unavailable.");
  const rows=z.array(request).parse(response.data);
  return <><h1>Locations</h1><p>Review new locations requested after trainer onboarding.</p><Link className="text-link" href="/admin/coverage/localities">Delhi locality catalog</Link>
    {!rows.length&&<p>No location requests need review.</p>}{rows.map(row=><article className="account-panel" key={row.id}><h2>{row.professional_name}</h2><p>{row.action==="add"?"Request to add":"Request to remove"} {row.locality_name} · {row.district}</p><ActionForm action={reviewLocalityRequest} submit="Save decision"><input type="hidden" name="request_id" value={row.id}/><label>Decision<select name="decision" defaultValue="approve"><option value="approve">Approve</option><option value="reject">Reject</option></select></label><label>Feedback<textarea name="feedback" required maxLength={1000}/></label><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>Confirm this location decision.</label></ActionForm></article>)}</>;
}
