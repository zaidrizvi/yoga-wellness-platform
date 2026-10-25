import { marketplaceLink } from "@/lib/marketplace/contracts";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/content/services";
import { getService } from "@/content/services";
import { PageHero } from "./page-hero";
import { FaqSection } from "./faq-section";
import { AppointmentNote } from "./appointment-note";
import { ProgramFeature } from "./program-feature";

export function ServiceDetail({ service,area }: { service: Service;area?:string }) {
  return <>
    <PageHero eyebrow={service.title} parent={{ href: "/services", label: "Services" }} title={service.title} emphasis={service.subtitle + "."} description={service.introduction} image={service.hero} action={{ href: "#overview", label: "Discover the experience" }} />
    <section id="overview" className="service-overview shell section-space" aria-labelledby="overview-title"><div className="reading-column"><p className="eyebrow">The experience</p><h2 id="overview-title">Personal attention.<br /><em>A familiar setting.</em></h2><p>{service.overview}</p><h3>Is this experience for you?</h3><p>{service.suitability}</p></div><aside className="session-details" aria-labelledby="session-details-title"><p className="eyebrow">Before you begin</p><h3 id="session-details-title">The session details</h3><dl><div><dt>Location</dt><dd>At your home in Delhi NCR, subject to professional coverage.</dd></div><div><dt>Pricing</dt><dd>Approved professional offerings set their own prices. Your exact price is proposed after assignment and requires your agreement.</dd></div><div><dt>Duration</dt><dd>Session length comes from the selected approved offering and is included in your proposal.</dd></div><div><dt>Preparation</dt><dd>{service.preparation}</dd></div></dl><div className="booking-cta"><Link className="text-link" href={marketplaceLink("/professionals",{service:service.slug,area})}>Choose a professional</Link><Button asChild><Link href={`/book/${service.slug}`}>Request help choosing</Link></Button><p>A request is subject to review and does not reserve an appointment.</p></div><Link href="/how-it-works" className="text-link">About appointment requests<ArrowUpRight size={16} aria-hidden="true" /></Link></aside></section>
    <section className="expectations-section" aria-labelledby="expect-title"><div className="shell section-space"><div className="section-heading"><div><p className="eyebrow">A considered home visit</p><h2 id="expect-title">What to <em>expect.</em></h2></div><p>General service information. Your selected professional?s approved offering and agreed proposal define the actual visit.</p></div><ol className="process-steps">{service.expectations.map((item, i) => <li key={item.title}><span className="step-number">0{i + 1}</span><h3>{item.title}</h3><p>{item.description}</p></li>)}</ol></div></section>
    <AppointmentNote /><FaqSection items={service.faqs} />
    {service.slug === "personal-yoga" && <ProgramFeature />}
    <section className="related-section shell section-space" aria-labelledby="related-title"><p className="eyebrow">A little more to explore</p><h2 id="related-title">Other paths to <em>wellbeing.</em></h2><div className="related-links">{service.related.map((slug) => { const related = getService(slug)!; return <Link href={marketplaceLink(`/services/${slug}`,{area})} key={slug}><span><span className="eyebrow">{related.category}</span><span className="related-title">{related.title}</span></span><ArrowUpRight aria-hidden="true" strokeWidth={1} /></Link>; })}</div></section>
  </>;
}
