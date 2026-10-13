import type { Metadata } from "next";
import { site } from "@/config/site";

export function pageMetadata(title: string, description: string, path: string): Metadata {
  const fullTitle = `${title} | ${site.name}`;
  return {
    title: fullTitle, description,
    alternates: site.url ? { canonical: new URL(path, site.url).href } : undefined,
    openGraph: {
      title: fullTitle, description, siteName: site.name, locale: "en_IN", type: "website",
      ...(site.url ? { url: new URL(path, site.url).href } : {}),
    },
  };
}
