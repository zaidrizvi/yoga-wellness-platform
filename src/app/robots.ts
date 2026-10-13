import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/" }, ...(site.url ? { sitemap: new URL("/sitemap.xml", site.url).href } : {}) };
}
