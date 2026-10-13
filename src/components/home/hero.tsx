import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorialImage } from "./editorial-image";
import Link from "next/link";

export function Hero() {
  return <section id="home" className="hero shell" aria-labelledby="hero-title">
    <div className="hero-copy">
      <p className="eyebrow"><span className="small-rule" /> Personal wellness · Delhi NCR</p>
      <h1 id="hero-title">Wellness,<br />thoughtfully<br /><em>brought home.</em></h1>
      <p className="hero-description">A little more balance. A little more you. Discover personal yoga and considered wellness experiences, in the comfort of your own home.</p>
      <div className="hero-actions"><Button asChild><Link href="/services">Explore Services <ArrowUpRight aria-hidden="true" /></Link></Button><a href="#how-it-works" className="text-link">How It Works <ArrowDown size={16} aria-hidden="true" /></a></div>
      <div className="hero-note"><span className="status-dot" /><p>A thoughtful new chapter in Delhi NCR.<br /><span>Preparing to launch. Booking requests are not yet open.</span></p></div>
    </div>
    <div className="hero-visual"><div className="visual-topline"><span>Room for a slower rhythm</span><span>01 / At home</span></div><EditorialImage src="/images/quiet-room.svg" alt="Original illustration of a quiet sunlit room with a yoga mat and a leafy plant." priority caption="Your space. Your pace." /><span className="hero-side-note" aria-hidden="true">Everyday rituals, thoughtfully considered</span></div>
  </section>;
}
