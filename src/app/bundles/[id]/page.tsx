import { notFound } from "next/navigation";
import { z } from "zod";
import { marketplaceData } from "@/lib/marketplace/data";
import { MarketplaceNotice,OfferingCard } from "@/components/marketplace/public";
import { money,indiaTime } from "@/lib/fulfillment/validation";
export const dynamic="force-dynamic";
export const metadata={title:"Reviewed wellness bundle | Aara"};
export default async function Bundle({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const data=await marketplaceData();if(!data.available)return <section className="shell account-shell"><h1>Wellness bundle.</h1><MarketplaceNotice/></section>;const b=data.bundles.find(b=>b.id===id);if(!b)notFound();return <section className="shell account-shell"><p className="eyebrow">Published promotion · information only</p><h1>{b.title}</h1><p>{b.description}</p><p className="offering-price">{money(b.price_minor)}</p><p>{b.discount_terms}</p><p>{b.locality_name} · {b.district}</p><p>Valid {indiaTime(b.starts_at)}–{indiaTime(b.ends_at)}</p><p className="application-feedback">Bundle purchase, redemption, complimentary-service fulfillment and package balances are not implemented. The individual booking links below request individual offerings at their own approved prices; they do not purchase this bundle.</p><h2>Included qualified providers & offerings</h2><div className="marketplace-grid">{b.items.map(i=><div key={i.offering_id}><p>Included quantity: {i.quantity}</p><OfferingCard offering={i} area={b.locality_id}/></div>)}</div></section>;}
