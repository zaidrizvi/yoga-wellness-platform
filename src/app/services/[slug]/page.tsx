import { notFound } from "next/navigation";
import { publishedService, publishedServices, servicePresentation } from "@/lib/data/public";
import { ServiceDetail } from "@/components/public/service-detail";
import { pageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props) {
  const row = await publishedService((await params).slug);
  if (!row) notFound();
  const service = servicePresentation(row);
  return pageMetadata(`${service.title} at Home`, `${service.description} Planned for Delhi NCR, subject to professional coverage.`, `/services/${service.slug}`);
}

export default async function ServicePage({ params }: Props) {
  const row = await publishedService((await params).slug);
  if (!row) notFound();
  const service = servicePresentation(row);
  const published = await publishedServices();
  return <ServiceDetail service={{ ...service, related: service.related.filter(slug => published.some(row => row.slug === slug)) }} />;
}
