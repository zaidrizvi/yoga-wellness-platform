import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { appointmentJourney } from "@/content/process";
import { faqs } from "@/content/home";
import { assets } from "@/content/services";
import { PageHero } from "@/components/public/page-hero";
import { FaqSection } from "@/components/public/faq-section";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("How At-home Appointments Work", "Understand service requests, approved trainer proposals, explicit customer agreement, professional acceptance and tracked home visits in Delhi NCR.", "/how-it-works");

export default function HowItWorksPage() {
  return <>
    <PageHero eyebrow="The appointment journey" title="A personal experience." emphasis="Thoughtfully coordinated." description="From exploring a service to welcoming a professional home, each step should be clear. Follow your request, proposed terms and appointment status in your account." image={assets.room} action={{ href: "#journey", label: "Follow the journey" }} />
    <section id="journey" className="journey shell section-space" aria-labelledby="journey-title"><div className="journey-intro"><p className="eyebrow">From a possibility to a home visit</p><h2 id="journey-title">A few clear steps.<br /><em>A considered process.</em></h2><p>Submit a service request, review the administrator?s proposed professional offering, and explicitly agree to its price and exact schedule. The professional must then accept before confirmation.</p><p className="confirmation-note">A request is not a confirmed appointment. Proposals, your agreement and professional acceptance are tracked in your booking details.</p><Link href="/services" className="text-link">Explore the services<ArrowUpRight size={17} aria-hidden="true" /></Link></div><ol className="journey-timeline">{appointmentJourney.map((step, i) => <li key={step.title}><span className="step-number">0{i + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol></section>
    <FaqSection items={faqs} title="Clear expectations," emphasis="from the start." />
  </>;
}
