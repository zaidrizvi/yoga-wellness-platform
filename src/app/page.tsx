import { Hero } from "@/components/home/hero";
import { Services } from "@/components/home/services";
import { YogaSpotlight } from "@/components/home/yoga-spotlight";
import { HowItWorks, OurApproach, DelhiNcr, Faq } from "@/components/home/information";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/config/site";
import { publishedServices, servicePresentation } from "@/lib/data/public";
import { yogaProgram } from "@/content/services";

export const metadata = pageMetadata("Personal Wellness at Home in Delhi NCR", site.description, "/");

export const dynamic = "force-dynamic";
export default async function Home() {
  const published = (await publishedServices()).map(servicePresentation);
  const offerings = [...published.map(s => ({ ...s, href: `/services/${s.slug}` })), yogaProgram];
  const items = offerings.map((s, i) => ({ ...s, number: String(i + 1).padStart(2, "0") }));
  return <><Hero /><div className="brand-manifesto"><p>Room to move. Space to breathe. <em>Time for yourself.</em></p><span>Wellness, in your own surroundings.</span></div><Services items={items} /><YogaSpotlight /><HowItWorks /><OurApproach /><DelhiNcr /><Faq /></>;
}
