import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { assets, getService, yogaProgram } from "@/content/services";
import { PageHero } from "@/components/public/page-hero";
import { FaqSection } from "@/components/public/faq-section";
import { AppointmentNote } from "@/components/public/appointment-note";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata(yogaProgram.title, "Explore planned monthly personal yoga at home in Delhi NCR, with potential 8-session and 12-session options and managed instructor assignment.", "/yoga-programs");

export default function YogaProgramsPage() {
  const yoga = getService("personal-yoga")!;
  return <>
    <PageHero eyebrow="Monthly personal yoga" title="A little practice." emphasis="A rhythm of your own." description="Make room for a regular practice in the comfort of home. Our planned monthly yoga programs bring individual guidance and a considered rhythm to your everyday life." image={assets.practice} action={{ href: "#program-rhythms", label: "Explore the planned rhythms" }} />
    <section className="shell reading-split section-space" aria-labelledby="regular-title"><div><p className="eyebrow">Personal attention, over time</p><h2 id="regular-title">A familiar practice.<br /><em>Space to keep going.</em></h2></div><div className="reading-column"><p>{yoga.description} A regular program is intended to give that personal practice a place in your routine, with time to revisit questions and discuss your preferences.</p><p>Consistency is about making space in your calendar. It does not promise a particular result. Instructor continuity is an intended priority so your practice can build on familiar guidance, subject to professional availability.</p><Link href={`/services/${yoga.slug}`} className="text-link">Explore {yoga.title}<ArrowUpRight size={17} aria-hidden="true" /></Link></div></section>
    <section id="program-rhythms" className="program-ledger" aria-labelledby="rhythms-title"><div className="shell"><div className="section-heading"><div><p className="eyebrow">Planning examples · Not finalized packages</p><h2 id="rhythms-title">Find a rhythm.<br /><em>Make it personal.</em></h2></div><p>Two possible monthly structures. The final offering may include configurable options, with details to be confirmed.</p></div><div className="rhythm-options">{yogaProgram.options.map((option) => <article key={option.sessions}><span className="rhythm-number">{String(option.sessions).padStart(2, "0")}</span><div><p className="eyebrow">Potential sessions per month</p><h3>{option.title}</h3><p>{option.description}</p></div></article>)}</div><div className="program-terms"><p>Session count, scheduling flexibility, instructor assignment, validity, prices, and session duration will be explained before programs are offered.</p><p>A monthly program is a planned grouping of sessions. It does not imply recurring billing or automatic renewal.</p></div></div></section>
    <section className="shell reading-split section-space" aria-labelledby="continuity-title"><div><p className="eyebrow">The person behind the practice</p><h2 id="continuity-title">Continuity,<br /><em>carefully considered.</em></h2></div><div className="reading-column"><p>Practising with a familiar instructor can make it easier to communicate preferences and revisit what you have explored together. Our intended assignment process will consider continuity alongside suitability, location, and schedule.</p><p>The team will confirm professional availability before confirming a program or its appointments. A preferred instructor or time cannot currently be guaranteed.</p><Link href="/professionals" className="text-link">Our professional approach<ArrowUpRight size={17} aria-hidden="true" /></Link></div></section>
    <AppointmentNote /><FaqSection items={yogaProgram.faqs} title="Before a new rhythm," emphasis="a little clarity." />
  </>;
}
