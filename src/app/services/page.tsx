import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { serviceCatalog } from "@/content/services";
import { PageHero } from "@/components/public/page-hero";
import { EditorialImage } from "@/components/home/editorial-image";
import { ProgramFeature } from "@/components/public/program-feature";
import { AppointmentNote } from "@/components/public/appointment-note";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("At-home Wellness Services", "Explore personal yoga training, naturopathy consultations, and massage and wellness therapy planned for home visits in Delhi NCR.", "/services");

export default function ServicesPage() {
  return <>
    <PageHero eyebrow="The service collection" title="Different paths." emphasis="Your kind of wellbeing." description="Movement, conversation, and time for rest. Explore our planned at-home services and find the experience that feels relevant to you." action={{ href: "#collection", label: "Explore the collection" }} />
    <section id="collection" className="catalog shell" aria-label="Wellness service collection">
      {serviceCatalog.map((service, i) => <article className="catalog-row" key={service.slug}>
        <EditorialImage {...service.hero} />
        <div className="catalog-copy"><p className="eyebrow">0{i + 1} / {service.category}</p><h2><Link href={`/services/${service.slug}`}>{service.title}</Link></h2><p className="catalog-subtitle">{service.subtitle}</p><p>{service.description}</p><span className="service-detail">{service.detail}</span><Link className="text-link" href={`/services/${service.slug}`}>Explore {service.title}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      </article>)}
    </section>
    <ProgramFeature /><AppointmentNote />
  </>;
}
