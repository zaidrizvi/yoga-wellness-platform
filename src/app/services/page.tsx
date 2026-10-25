import { marketplaceLink } from "@/lib/marketplace/contracts";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { publishedServices, servicePresentation } from "@/lib/data/public";
import { PageHero } from "@/components/public/page-hero";
import { EditorialImage } from "@/components/home/editorial-image";
import { ProgramFeature } from "@/components/public/program-feature";
import { AppointmentNote } from "@/components/public/appointment-note";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("At-home Wellness Services", "Explore personal yoga training, naturopathy consultations, and massage and wellness therapy for home visits in Delhi NCR.", "/services");

export const dynamic = "force-dynamic";
export default async function ServicesPage({searchParams=Promise.resolve({})}:{searchParams?:Promise<{area?:string}>}={}) {
  const {area}=await searchParams;
  const serviceCatalog = (await publishedServices()).map(servicePresentation);
  return <>
    <PageHero eyebrow="The service collection" title="Different paths." emphasis="Your kind of wellbeing." description="Movement, conversation, and time for rest. Explore our at-home services and find the experience that feels relevant to you." action={{ href: "#collection", label: "Explore the collection" }} />
    <section id="collection" className="catalog shell" aria-label="Wellness service collection">
      {!serviceCatalog.length && <p>Published services are not currently available. Please check back soon.</p>}
      {serviceCatalog.map((service, i) => <article className="catalog-row" key={service.slug}>
        <EditorialImage {...service.hero} />
        <div className="catalog-copy"><p className="eyebrow">0{i + 1} / {service.category}</p><h2><Link href={marketplaceLink(`/services/${service.slug}`,{area})}>{service.title}</Link></h2><p className="catalog-subtitle">{service.subtitle}</p><p>{service.description}</p><span className="service-detail">{service.detail}</span><Link className="text-link" href={marketplaceLink(`/services/${service.slug}`,{area})}>Explore {service.title}<ArrowUpRight size={17} aria-hidden="true" /></Link><div className="booking-cta"><Link className="text-link" href={marketplaceLink("/professionals",{service:service.slug,area})}>Choose a professional</Link><Button asChild><Link href={`/book/${service.slug}`}>Request help choosing</Link></Button></div></div>
      </article>)}
    </section>
    <ProgramFeature /><AppointmentNote />
  </>;
}
