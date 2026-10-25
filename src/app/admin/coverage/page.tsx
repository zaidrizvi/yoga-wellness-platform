import { MarketplaceAudit } from "@/components/marketplace/audit";
import { AdminLocalityCoverage } from "@/components/admin/locality-coverage";
import { catalogLocalities } from "@/lib/marketplace/data";
import { marketplaceRpc,marketplacePending } from "@/lib/marketplace/rpc";
import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
export const metadata={title:"Coverage Management | Aara"};
export default async function Coverage(){
  const {supabase}=await requireAccount("admin");
  const [catalog,native]=await Promise.all([catalogLocalities(),marketplaceRpc(supabase,"admin_locality_coverage_overview")]);
  if(native.error&&!marketplacePending(native.error))throw new Error("Locality coverage is temporarily unavailable.");
  const overview=native.error?null:z.object({professionals:z.array(z.object({id:z.uuid(),name:z.string(),requested_localities:z.array(z.uuid()),approved_localities:z.array(z.uuid()),approved_offerings:z.number(),availability_windows:z.number()}))}).parse(native.data);
  return <><Link className="text-link" href="/admin/coverage/localities">Review Delhi locality catalog</Link><Link className="text-link" href="/admin/services/offerings">Review professional coverage requests</Link><h1>Coverage Management.</h1><p>Manage supported Delhi localities and explicitly approve each trainer working areas.</p>{overview?<AdminLocalityCoverage localities={catalog.localities} professionals={overview.professionals}/>:<p role="status">The locality-first controls are ready. Their database migration must be approved and deployed before coverage decisions can be saved.</p>}<MarketplaceAudit/></>;
}
