import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { appointmentJourney } from "@/content/process";
import { faqs } from "@/content/home";
import { assets } from "@/content/services";
import { PageHero } from "@/components/public/page-hero";
import { FaqSection } from "@/components/public/faq-section";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("How At-home Appointments Will Work", "Understand the planned managed booking journey: request, availability review, professional assignment, explicit confirmation, and a home visit in Delhi NCR.", "/how-it-works");

export default function HowItWorksPage() {
  return <>
    <PageHero eyebrow="The intended appointment journey" title="A personal experience." emphasis="Thoughtfully coordinated." description="From exploring a service to welcoming a professional home, each step should be clear. Here is the process we are preparing for launch." image={assets.room} action={{ href: "#journey", label: "Follow the journey" }} />
    <section id="journey" className="journey shell section-space" aria-labelledby="journey-title"><div className="journey-intro"><p className="eyebrow">From a possibility to a home visit</p><h2 id="journey-title">A few clear steps.<br /><em>A considered process.</em></h2><p>Booking requests are not yet open. This is the intended workflow for a later phase.</p><p className="confirmation-note">A request is not a confirmed appointment. Assignment and confirmation will be managed by the team.</p><Link href="/services" className="text-link">Explore the services<ArrowUpRight size={17} aria-hidden="true" /></Link></div><ol className="journey-timeline">{appointmentJourney.map((step, i) => <li key={step.title}><span className="step-number">0{i + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol></section>
    <FaqSection items={faqs} title="Clear expectations," emphasis="from the start." />
  </>;
}
