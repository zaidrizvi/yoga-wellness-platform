import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { publishedService } from "@/lib/data/public";
import { savedAddresses, bookingOptions } from "@/lib/booking/data";
import { indiaDateTime, lastBookingDate } from "@/lib/booking/validation";
import { BookingForm } from "@/components/booking/booking-form";

export const metadata = { title: "Request a booking | Aara" };
export default async function BookPage({ params, searchParams }: { params: Promise<{ serviceSlug: string }>; searchParams: Promise<{ address?: string }> }) {
  const { supabase, user } = await requireAccount("customer");
  const { serviceSlug } = await params;
  const service = await publishedService(serviceSlug);
  if (!service) notFound();
  const [addresses, options, query] = await Promise.all([savedAddresses(supabase, user.id), bookingOptions(supabase), searchParams]);
  const today = indiaDateTime().date;
  return <section className="shell account-shell"><p className="eyebrow">A request first</p><h1>Care, at your doorstep.</h1><p>Share your preferred visit details. Your request is subject to review before any appointment can be confirmed.</p><div className="booking-layout"><aside className="account-panel booking-context"><p className="eyebrow">Step 1 / Your selected service</p><h2>{service.name}</h2><p>{service.short_description}</p>{service.duration_minutes !== null && <p>Duration: {service.duration_minutes} minutes</p>}{service.price_minor !== null ? <p>Published service price: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(service.price_minor / 100)}</p> : <p>Pricing has not yet been published. Any charges are subject to approved service terms.</p>}<p>Delhi NCR service eligibility is subject to review. Submitting this form does not reserve a professional or time slot.</p><Link className="text-link" href={`/services/${service.slug}`}>Service details</Link></aside><div className="account-panel">{addresses.length ? <BookingForm service={service} addresses={addresses} options={options} idempotencyKey={randomUUID()} minDate={today} maxDate={lastBookingDate(today, options[0].booking_horizon_days)} selectedAddress={query.address} /> : <><h2>Start with your address.</h2><p>Save your visit address and contact details, then return here to choose your preferred date and time.</p><Link className="text-link" href={`/account/addresses?returnTo=${encodeURIComponent(`/book/${service.slug}`)}`}>Add your first address</Link></>}</div></div></section>;
}
