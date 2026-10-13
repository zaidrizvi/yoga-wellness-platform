import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function AppointmentNote() {
  return <section className="appointment-band" aria-labelledby="appointment-title"><div className="shell appointment-layout"><p className="eyebrow">Personal care, carefully coordinated</p><div><h2 id="appointment-title">A request first.<br /><em>A confirmation to follow.</em></h2><p>When booking opens, share your preferred date, appointment window, and location. The team will review coverage and availability, assign an eligible professional, and then confirm the appointment. A request alone does not confirm a visit.</p><span className="launch-note">Preparing to launch in Delhi NCR. Booking requests are not yet open.</span></div><Link href="/how-it-works" className="text-link">How appointments will work<ArrowUpRight size={17} aria-hidden="true" /></Link></div></section>;
}
