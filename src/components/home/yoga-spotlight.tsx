import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorialImage } from "./editorial-image";
import Link from "next/link";
import { yogaProgram } from "@/content/services";

export function YogaSpotlight() {
  return <section id="yoga-programs" className="yoga-section" aria-labelledby="yoga-title"><div className="shell yoga-layout">
    <EditorialImage src="/images/practice-study.svg" alt="Original illustration of a yoga mat and folded towel beside a tall window." caption="A practice to come home to." />
    <div className="yoga-copy"><p className="eyebrow">02 / A little consistency</p><h2 id="yoga-title">Not just a session.<br /><em>A way of being.</em></h2><p>A regular yoga practice can become a meaningful part of your week. Our planned monthly programs bring personal attention and a steady rhythm to your home.</p><div className="program-options">{yogaProgram.options.map((option) => <div key={option.sessions}><span>{String(option.sessions).padStart(2, "0")}</span><p>sessions / month</p></div>)}</div><p className="program-note">Potential monthly options. Final packages, schedules, and pricing will be shared at launch, subject to professional availability.</p><Button asChild variant="outline" className="yoga-button"><Link href="/yoga-programs">Explore monthly programs <ArrowUpRight aria-hidden="true" /></Link></Button><span className="yoga-footnote">Personal attention. A rhythm of your own.</span></div>
  </div></section>;
}
