import { Hero } from "@/components/home/hero";
import { Services } from "@/components/home/services";
import { YogaSpotlight } from "@/components/home/yoga-spotlight";
import { HowItWorks, OurApproach, DelhiNcr, Faq } from "@/components/home/information";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/config/site";

export const metadata = pageMetadata("Personal Wellness at Home in Delhi NCR", site.description, "/");

export default function Home() {
  return <><Hero /><div className="brand-manifesto"><p>Room to move. Space to breathe. <em>Time for yourself.</em></p><span>Wellness, in your own surroundings.</span></div><Services /><YogaSpotlight /><HowItWorks /><OurApproach /><DelhiNcr /><Faq /></>;
}
