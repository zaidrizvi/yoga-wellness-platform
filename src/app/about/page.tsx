import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { site } from "@/config/site";
import { approach } from "@/content/home";
import { assets } from "@/content/services";
import { PageHero } from "@/components/public/page-hero";
import { DelhiNcr } from "@/components/home/information";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("Our Approach to Personal Wellness", "Discover Aara's intended approach to personalized wellness at home: thoughtful professional care, clear communication, and a managed Delhi NCR launch.", "/about");

export default function AboutPage() {
  return <>
    <PageHero eyebrow={`The ${site.name} approach`} title="A little more care." emphasis="Closer to everyday life." description="Wellness should have a place in the life you already lead. We are building a thoughtful way to bring personal guidance and considered home visits into your own surroundings." image={assets.botanical} action={{ href: "#our-values", label: "What guides us" }} />
    <section className="about-statement" aria-labelledby="statement-title"><div className="shell"><p className="eyebrow">A simple intention</p><h2 id="statement-title">The comfort of home.<br />The care of a personal experience.<br /><em>Room to be yourself.</em></h2><p>A familiar setting can make space for a conversation, a practice, or a moment of rest. Convenience should come with clear information, suitable professional guidance, and respect for your preferences.</p></div></section>
    <section id="our-values" className="shell reading-split section-space" aria-labelledby="values-title"><div><p className="eyebrow">What guides the work</p><h2 id="values-title">Thoughtful by intention.<br /><em>Clear by design.</em></h2><p className="values-intro">These principles describe the platform we intend to build. We will make service details and professional information available as they are confirmed.</p><Link href="/professionals" className="text-link">The people and the process<ArrowUpRight size={17} aria-hidden="true" /></Link></div><div className="approach-list">{approach.map((item, i) => <article key={item.title}><span>0{i + 1}</span><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div></section>
    <DelhiNcr />
    <section className="about-closing shell" aria-labelledby="closing-title"><p className="eyebrow">A considered beginning</p><h2 id="closing-title">Find your own way<br /><em>to feel well.</em></h2><Link href="/services" className="text-link">Explore the service collection<ArrowUpRight size={17} aria-hidden="true" /></Link></section>
  </>;
}
