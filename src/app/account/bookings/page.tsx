import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { bookingOptions, customerBookings } from "@/lib/booking/data";
import { formatBookingDate } from "@/lib/booking/validation";

import { refreshProposals } from "@/lib/fulfillment/data";
import { statusLabel } from "@/lib/fulfillment/validation";

export const metadata = { title: "Your booking requests | Aara" };
export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase, user } = await requireAccount("customer");
  await refreshProposals(supabase);
  const query = await searchParams;
  const page = z.coerce.number().int().min(1).max(1000000).catch(1).parse(query.page ?? 1);
  const [{ bookings, count }, options] = await Promise.all([customerBookings(supabase, user.id, page), bookingOptions(supabase)]);
  return <><p className="eyebrow">Your requests</p><h1>Bookings & appointments.</h1><p>A pending request is awaiting review. It does not confirm an appointment or reserve a time slot.</p><Link href="/services" className="text-link">Explore services</Link>{!bookings.length && <div className="account-panel"><h2>A little care, when you need it.</h2><p>{page === 1 ? "You have no booking requests yet. Choose a service to make your first request." : "No requests are available on this page. Return to newer requests."}</p></div>}<div className="booking-grid">{bookings.map(b => <article key={b.id} className="account-panel"><p className="booking-status">{statusLabel(b.status)}</p><h2>{b.service_name}</h2><p>{formatBookingDate(b.preferred_date)}<br />{options.find(o => o.window_key === b.time_window)?.label ?? b.time_window} (India time)</p><p>Requested {new Date(b.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p><Link href={`/account/bookings/${b.id}`} className="text-link">View request details</Link></article>)}</div><nav className="account-links" aria-label="Booking history pages">{page > 1 && <Link href={`/account/bookings?page=${page - 1}`}>Newer requests</Link>}{page * 20 < count && <Link href={`/account/bookings?page=${page + 1}`}>Older requests</Link>}</nav></>;
}
