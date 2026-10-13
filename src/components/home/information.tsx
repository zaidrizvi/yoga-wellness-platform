import { ArrowUpRight, MapPin } from "lucide-react";
import { approach, faqs, steps } from "@/content/home";
import { FaqSection } from "@/components/public/faq-section";
import { site } from "@/config/site";
import Link from "next/link";

export function HowItWorks() {
  return <section id="how-it-works" className="section-space shell" aria-labelledby="process-title"><div className="section-heading"><div><p className="eyebrow">03 / Thoughtfully coordinated</p><h2 id="process-title">Your wellbeing.<br /><em>A simpler journey.</em></h2></div><p>Personal care deserves a personal process. Here is how home visits will work when booking opens.</p></div><ol className="process-steps">{steps.map((step, i) => <li key={step.title}><span className="step-number">0{i + 1}</span><h3>{step.title}</h3><p>{step.description}</p></li>)}</ol><p className="confirmation-note">A booking request is the first step. An appointment is confirmed only after professional assignment and explicit confirmation.</p><Link href="/how-it-works" className="text-link section-link">The complete journey <ArrowUpRight size={17} aria-hidden="true" /></Link></section>;
}

export function OurApproach() {
  return <section id="our-approach" className="approach-section section-space" aria-labelledby="approach-title"><div className="shell approach-layout"><div className="approach-intro"><p className="eyebrow">04 / The {site.name} approach</p><h2 id="approach-title">Considered care.<br /><em>Human connection.</em></h2><p>We are building a more thoughtful way to experience wellness at home. One guided by people, clarity, and respect for your everyday life.</p><Link href="/professionals" className="text-link section-link">Our professional approach <ArrowUpRight size={17} aria-hidden="true" /></Link><span className="approach-mark" aria-hidden="true">{site.name.charAt(0).toLowerCase()}.</span></div><div className="approach-list">{approach.map((item, i) => <article key={item.title}><span>0{i + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div></div></section>;
}

export function DelhiNcr() {
  return <section id="delhi-ncr" className="location-section shell" aria-labelledby="location-title"><div className="location-symbol" aria-hidden="true"><MapPin strokeWidth={1} /><span>28.61° N · 77.21° E</span></div><div><p className="eyebrow">Rooted here. Beginning here.</p><h2 id="location-title">Our first chapter: <em>Delhi NCR.</em></h2><p>Bringing a little more wellbeing to the place you call home. We are preparing to launch across Delhi NCR; exact service availability will depend on professional coverage and your location.</p></div><Link href="/services" className="text-link">Discover the services <ArrowUpRight size={17} aria-hidden="true" /></Link></section>;
}

export function Faq() {
  return <FaqSection items={faqs} />;
}
