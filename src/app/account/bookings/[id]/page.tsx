import Link from "next/link";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { bookingOptions } from "@/lib/booking/data";
import { addressSchema, formatBookingDate } from "@/lib/booking/validation";
import { AddressSummary } from "@/components/booking/address-summary";
import { ActionForm } from "@/components/auth/action-form";
import { cancelBooking } from "@/app/book/actions";

import { refreshProposals } from "@/lib/fulfillment/data";
import { statusLabel } from "@/lib/fulfillment/validation";
import { CustomerProposal } from "@/components/fulfillment/customer-proposal";

export const metadata = { title: "Booking request details | Aara" };
export default async function BookingDetails({ params }: { params: Promise<{ id: string }> }) {
  const { supabase, user } = await requireAccount("customer");
  const { id } = await params;
  await refreshProposals(supabase);
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: booking, error } = await supabase.from("booking_requests").select("*").eq("id", id).eq("customer_id", user.id).maybeSingle();
  if (error) throw new Error("Request details are temporarily unavailable.");
  if (!booking) notFound();
  const snapshot = addressSchema.safeParse(booking.address_snapshot);
  if (!snapshot.success) throw new Error("Request address details are temporarily unavailable.");
  const options = await bookingOptions(supabase);
  return <><p className="eyebrow">Your booking request</p><h1>{booking.service_name}</h1><p className="booking-status">{statusLabel(booking.status)}</p><p className="booking-reference">Request reference: {booking.id}</p>{booking.status === "pending" && <p>Your booking request has been received. The details require review before an appointment can be confirmed. No professional has been assigned and no time slot is reserved by this request.</p>}<div className="booking-grid"><section className="account-panel"><h2>Preferred visit</h2><p>{formatBookingDate(booking.preferred_date)}<br />{options.find(o => o.window_key === booking.time_window)?.label ?? booking.time_window} (India time)</p><p>Submitted {new Date(booking.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>{booking.customer_notes && <p className="booking-notes">Your note: {booking.customer_notes}</p>}{booking.cancelled_at && <p>Cancelled {new Date(booking.cancelled_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>}</section><section className="account-panel"><h2>Submitted address</h2><AddressSummary address={snapshot.data} /><p>This is the address recorded when you submitted the request. Later saved-address edits do not change it.</p></section></div>{booking.status === "pending" && <section className="account-panel"><h2>Cancel this request</h2><p>You may cancel while the request is pending. This keeps the request in your history.</p><ActionForm action={cancelBooking} submit="Cancel pending request"><input type="hidden" name="booking_id" value={booking.id} /><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />I confirm that I want to cancel this pending request.</label></ActionForm></section>}<CustomerProposal client={supabase} booking={booking} /><nav className="account-links" aria-label="Booking navigation"><Link href="/account/bookings">All my requests</Link><Link href="/services">Explore services</Link></nav></>;
}
