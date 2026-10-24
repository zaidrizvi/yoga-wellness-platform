import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { navigation } from "@/config/site";
import { publishedServices } from "@/lib/data/public";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // No fabricated origin; becomes populated when a real canonical URL is set.
  if (!site.url) return [];
  const paths = ["/join-as-professional", ...navigation.map(({ href }) => href), ...(await publishedServices()).map(({ slug }) => `/services/${slug}`)];
  return paths.map((path) => ({ url: new URL(path, site.url).href, changeFrequency: "monthly", priority: path === "/" ? 1 : .8 }));
}
