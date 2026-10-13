import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { yogaProgram } from "@/content/services";

export function ProgramFeature() {
  return <section className="program-feature" aria-labelledby="program-feature-title"><div className="shell program-feature-layout"><div><p className="eyebrow">A practice, with a rhythm</p><h2 id="program-feature-title">Personal yoga.<br /><em>Month by month.</em></h2></div><div><p>{yogaProgram.description} Potential 8-session and 12-session options are planning examples, with final details to follow.</p><Link className="text-link" href={yogaProgram.href}>Explore {yogaProgram.title}<ArrowUpRight size={17} aria-hidden="true" /></Link></div></div></section>;
}
