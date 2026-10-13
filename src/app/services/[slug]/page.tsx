import { notFound } from "next/navigation";
import { serviceCatalog, getService } from "@/content/services";
import { ServiceDetail } from "@/components/public/service-detail";
import { pageMetadata } from "@/lib/metadata";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return serviceCatalog.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props) {
  const service = getService((await params).slug);
  if (!service) notFound();
  return pageMetadata(`${service.title} at Home`, `${service.description} Planned for Delhi NCR, subject to professional coverage.`, `/services/${service.slug}`);
}

export default async function ServicePage({ params }: Props) {
  const service = getService((await params).slug);
  if (!service) notFound();
  return <ServiceDetail service={service} />;
}
