import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { appointmentJourney } from "@/content/process";
import { faqs } from "@/content/home";
import { PageHero } from "@/components/public/page-hero";
import { FaqSection } from "@/components/public/faq-section";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("How At-home Appointments Work", "Understand service requests, approved trainer proposals, explicit customer agreement, professional acceptance and tracked home visits in Delhi NCR.", "/how-it-works");

export default function HowItWorksPage() {
  return <>
    <PageHero eyebrow="How it works" title="Book wellness care" emphasis="with confidence." description="Find a verified trainer, compare approved options and request a convenient time." action={{ href: "#journey", label: "See the steps" }} />
    <section id="journey" className="journey shell section-space" aria-labelledby="journey-title"><div className="journey-intro"><p className="eyebrow">Five clear steps</p><h2 id="journey-title">From search to session.</h2><p>You can browse freely and sign in only when you’re ready to request a session.</p><p className="confirmation-note">A request is not a confirmed appointment. Your selected trainer must accept it first.</p><Link href="/professionals" className="primary-link">Find Trainers<ArrowUpRight size={17} aria-hidden="true" /></Link></div><ol className="journey-timeline">{appointmentJourney.map((step, i) => <li key={step.title}><span className="step-number">0{i + 1}</span><div><h3>{step.title}</h3><p>{step.description}</p></div></li>)}</ol></section>
    <FaqSection items={faqs} title="Clear expectations," emphasis="from the start." />
  </>;
}
