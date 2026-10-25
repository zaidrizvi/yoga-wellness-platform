import { publishedServices } from "@/lib/data/public";
import { marketplaceData } from "@/lib/marketplace/data";
import { DiscoveryFilters,ProfessionalCard,MarketplaceNotice } from "@/components/marketplace/public";
import { pageMetadata } from "@/lib/metadata";
export const dynamic="force-dynamic";
export const metadata=pageMetadata("Find Verified Wellness Professionals in Delhi","Browse reviewed professionals and approved offerings. Choose an optional Delhi locality, compare services and request your preferred trainer.","/professionals");
export default async function Directory({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const query=await searchParams;const [data,services]=await Promise.all([marketplaceData(query),publishedServices()]);
 return <section className="shell account-shell"><p className="eyebrow">Your wellness, your choice</p><h1>Find your kind of care.</h1><p>Explore eligible, verified professionals across our configured Delhi service region. Choose a locality only if you want to narrow your search. No account is needed to browse.</p><DiscoveryFilters localities={data.localities} services={services} query={query} available={data.available} catalogAvailable={data.catalogAvailable}/>{!data.available?<MarketplaceNotice/>:data.invalid?<p role="alert">That filter or locality is unavailable. Clear the filters or choose a Delhi locality.</p>:<><p role="status">{data.professionals.length} professional{data.professionals.length===1?"":"s"} found{query.area?" for your selected locality":" · All Delhi"}.</p><div className="marketplace-grid">{data.professionals.map(p=><ProfessionalCard key={p.professional_id} person={p} area={query.area}/>)}</div>{!data.professionals.length&&<p className="marketplace-empty">{query.area?"No professionals available in this area yet.":"No approved professionals match these filters."}</p>}</>}</section>;
}
