import { ArrowUpRight } from "lucide-react";
import { services } from "@/content/home";
import { EditorialImage } from "./editorial-image";
import Link from "next/link";

export function Services() {
  return <section id="services" className="services-section section-space" aria-labelledby="services-title">
    <div className="shell">
      <div className="section-heading"><div><p className="eyebrow">01 / The ways to feel well</p><h2 id="services-title">Care that meets you<br /><em>where you are.</em></h2></div><p>From a mindful morning practice to a moment of rest, explore a more personal approach to wellness.</p></div>
      <div className="services-layout">
        <div className="service-visual"><EditorialImage src="/images/botanical-study.svg" alt="Original still-life illustration of a terracotta vase, botanical stems, and folded linens." caption="Simple rituals. A considered life." /><p className="image-note">Four paths to wellbeing.<br /><em>One familiar place.</em></p></div>
        <div className="service-list">{services.map((service) => <article key={service.number} className="service-row"><span className="service-number">{service.number}</span><div><p className="service-subtitle">{service.subtitle}</p><h3><Link href={service.href}>{service.title}</Link></h3><p>{service.description}</p><span className="service-detail">{service.detail}</span><Link href={service.href} className="service-program-link">{service.number === "02" ? "Explore the monthly practice" : "Discover this service"} <ArrowUpRight size={16} aria-hidden="true" /></Link></div></article>)}</div>
      </div>
    </div>
  </section>;
}
