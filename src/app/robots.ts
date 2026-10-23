import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/account", "/auth/", "/login", "/signup", "/forgot-password", "/update-password"] }, ...(site.url ? { sitemap: new URL("/sitemap.xml", site.url).href } : {}) };
}
