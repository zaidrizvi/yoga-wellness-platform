import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { marketplaceRpc,marketplacePending } from "@/lib/marketplace/rpc";
import { LocalityAdminForm } from "@/components/marketplace/admin-forms";
import { MarketplaceNotice } from "@/components/marketplace/public";
const row=z.object({id:z.uuid(),name:z.string(),district:z.string(),region_code:z.string(),source_url:z.string(),verified:z.boolean(),is_active:z.boolean(),updated_at:z.string(),service_area_ids:z.array(z.uuid())});
export default async function Localities({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
  const {supabase}=await requireAccount("admin");const query=await searchParams;const page=z.coerce.number().int().min(1).max(1000).catch(1).parse(query.page??1);
  const catalog=await marketplaceRpc(supabase,"admin_marketplace_localities",{p_search:(query.q??"").slice(0,120),p_offset:(page-1)*50});
  if(marketplacePending(catalog.error))return <><h1>Delhi locality catalog</h1><MarketplaceNotice/></>;
  if(catalog.error)throw new Error("Locality catalog unavailable.");const rows=z.array(row).parse(catalog.data);
  return <><h1>Delhi locality catalog</h1><p>Verify locality names before making them available.</p><Link className="text-link" href="/admin/coverage">Location requests</Link>
    <form method="get" className="account-form"><label>Find locality or district<input name="q" maxLength={120} defaultValue={query.q}/></label><button className="text-link" type="submit">Search</button></form>
    <details className="account-panel"><summary>Add missing locality</summary><LocalityAdminForm/></details>
    {rows.map(r=><article className="account-panel" key={r.id}><h2>{r.name}</h2><p>{r.district} · {r.is_active?"Available":"Unavailable"} · {r.verified?"Verified":"Needs review"}</p><a className="text-link" href={r.source_url} target="_blank" rel="noreferrer">Check source</a><details><summary>Edit locality</summary><LocalityAdminForm key={r.updated_at} row={r}/></details>{r.is_active&&<Link className="text-link" href={`/professionals?area=${r.id}`}>View trainers</Link>}</article>)}
    {!rows.length&&<p>No matching localities.</p>}<nav className="account-links" aria-label="Locality catalog pages">{page>1&&<Link href={`?q=${encodeURIComponent(query.q??"")}&page=${page-1}`}>Previous</Link>}{rows.length===50&&<Link href={`?q=${encodeURIComponent(query.q??"")}&page=${page+1}`}>More</Link>}</nav></>;
}
