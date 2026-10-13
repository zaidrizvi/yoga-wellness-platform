import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { professionalApproach } from "@/content/professionals";
import { PageHero } from "@/components/public/page-hero";
import { AppointmentNote } from "@/components/public/appointment-note";
import { EditorialImage } from "@/components/home/editorial-image";
import { assets } from "@/content/services";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("Our Wellness Professionals Approach", "Learn how Aara intends to review professional qualifications, consider suitable assignment, and support instructor continuity. Genuine profiles are pending.", "/professionals");

export default function ProfessionalsPage() {
  return <>
    <PageHero eyebrow="The people behind the care" title="Personal wellness." emphasis="A human connection." description="The right professional matters. We are building an approach that considers service-specific qualifications, relevant experience, and the fit between a person and your needs." action={{ href: "#professional-approach", label: "Our intended approach" }} />
    <section id="professional-approach" className="professional-section" aria-labelledby="professional-title"><div className="shell professional-layout section-space"><div><EditorialImage {...assets.botanical} /><p className="professional-caption">Care begins with the person.<br /><em>Trust begins with clarity.</em></p></div><div><p className="eyebrow">A considered review, before assignment</p><h2 id="professional-title">Quality is a process.<br /><em>Not just a promise.</em></h2><div className="approach-list professional-principles">{professionalApproach.map((item, i) => <article key={item.title}><span>0{i + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div></div></div></section>
    <section className="profiles-state shell" aria-labelledby="profiles-title"><p className="eyebrow">A thoughtful introduction, when ready</p><div><h2 id="profiles-title">Meet the professionals.<br /><em>In a future chapter.</em></h2><p>Genuine professional profiles have not yet been supplied. When reviewed records are available, this space will introduce service specialties, qualifications, experience, and service-area information.</p><p>There are no live provider listings or completed verification claims on this website. The team will manage assignment and scheduling when booking becomes available.</p><Link href="/services" className="text-link">Explore the planned services<ArrowUpRight size={17} aria-hidden="true" /></Link></div></section>
    <AppointmentNote />
  </>;
}
