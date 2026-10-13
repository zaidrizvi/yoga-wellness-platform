import { site } from "@/config/site";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function Brand({ className }: { className?: string }) {
  return <Link href="/" aria-label={`${site.name} home`} className={cn("brand", className)}>
    <svg viewBox="0 0 36 40" fill="none" aria-hidden="true"><path d="M18 36V11M18 23C4 24 1 14 4 4c11 1 15 8 14 19ZM18 31c14 1 18-10 14-20-10 2-15 9-14 20Z" stroke="currentColor" strokeWidth="1.5" /></svg>
    <span>{site.name.toLowerCase()}<span className="brand-dot">.</span></span>
  </Link>;
}
