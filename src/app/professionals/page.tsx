import { publishedServices } from "@/lib/data/public";
import { marketplaceData } from "@/lib/marketplace/data";
import { DiscoveryFilters,ProfessionalCard,MarketplaceNotice } from "@/components/marketplace/public";
import { pageMetadata } from "@/lib/metadata";
export const dynamic="force-dynamic";
export const metadata=pageMetadata("Find Verified Wellness Professionals in Delhi","Find verified Delhi trainers, compare approved prices and request a session.","/professionals");
export default async function Directory({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const query=await searchParams;const [data,services]=await Promise.all([marketplaceData(query),publishedServices()]);
 return <section className="shell account-shell"><p className="eyebrow">Verified trainers across Delhi</p><h1>Find a trainer.</h1><DiscoveryFilters localities={data.localities} services={services} query={query} available={data.available} catalogAvailable={data.catalogAvailable}/>{!data.available?<MarketplaceNotice/>:data.invalid?<p role="alert">That filter is unavailable. Clear the filters and try again.</p>:<><p role="status"><strong>{data.professionals.length}</strong> trainer{data.professionals.length===1?"":"s"}{query.area?" in this area":" · All Delhi"}</p><div className="marketplace-grid">{data.professionals.map(p=><ProfessionalCard key={p.professional_id} person={p} area={query.area}/>)}</div>{!data.professionals.length&&<p className="marketplace-empty">No professionals available in this area yet.</p>}</>}</section>;
}
