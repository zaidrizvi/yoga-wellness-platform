import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { navigation } from "@/config/site";
import { serviceCatalog } from "@/content/services";

export default function sitemap(): MetadataRoute.Sitemap {
  // No fabricated origin; becomes populated when a real canonical URL is set.
  if (!site.url) return [];
  const paths = [...navigation.map(({ href }) => href), ...serviceCatalog.map(({ slug }) => `/services/${slug}`)];
  return paths.map((path) => ({ url: new URL(path, site.url).href, changeFrequency: "monthly", priority: path === "/" ? 1 : .8 }));
}
