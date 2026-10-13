import Image from "next/image";
import { cn } from "@/lib/utils";

// TODO: Replace with licensed wellness photography. These original SVGs are
// intentional illustrations, not photographs or depictions of real providers.
export function EditorialImage({ src, alt, className, priority = false, caption }: { src: string; alt: string; className?: string; priority?: boolean; caption: string }) {
  return <figure className={cn("editorial-figure", className)}>
    <div className="editorial-image"><Image src={src} alt={alt} fill sizes="(max-width: 767px) 90vw, (max-width: 1100px) 50vw, 640px" priority={priority} /></div>
    <figcaption><span>{caption}</span><span>Illustration · photography to follow</span></figcaption>
  </figure>;
}
