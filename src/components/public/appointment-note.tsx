import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function AppointmentNote() {
  return <section className="appointment-band" aria-labelledby="appointment-title"><div className="shell appointment-layout"><p className="eyebrow">Personal care, carefully coordinated</p><div><h2 id="appointment-title">A request first.<br /><em>A confirmation to follow.</em></h2><p>Share your preferred date, appointment window, and location. The team will review coverage and availability, propose an eligible professional offering with its actual price and exact schedule. You agree to those terms, then the professional accepts before confirmation. A request alone does not confirm a visit.</p><span className="launch-note">Delhi NCR coverage and appointment timing are subject to review.</span></div><Link href="/how-it-works" className="text-link">How appointments work<ArrowUpRight size={17} aria-hidden="true" /></Link></div></section>;
}
