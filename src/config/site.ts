export function getSiteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): URL | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return undefined;
    return new URL(url.origin);
  } catch {
    return undefined;
  }
}

export const site = {
  name: "Aara",
  tagline: "Wellness, thoughtfully brought home.",
  description: "Explore personal yoga, monthly yoga programs, naturopathy consultations, and massage and wellness therapy at home. Preparing to launch in Delhi NCR.",
  url: getSiteUrl(),
};

export const navigation = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Yoga Programs", href: "/yoga-programs" },
  { label: "Professionals", href: "/professionals" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Our Approach", href: "/about" },
] as const;
