import { DirectChoice } from "@/components/marketplace/direct-choice";
import Link from "next/link";
import { z } from "zod";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { bookingOptions } from "@/lib/booking/data";
import { addressSchema,formatBookingDate } from "@/lib/booking/validation";
import { AddressSummary } from "@/components/booking/address-summary";
import { ActionForm } from "@/components/auth/action-form";
import { cancelBooking } from "@/app/book/actions";
import { refreshProposals } from "@/lib/fulfillment/data";
import { statusLabel } from "@/lib/fulfillment/validation";
import { CustomerProposal } from "@/components/fulfillment/customer-proposal";
import { Button } from "@/components/ui/button";
export const metadata={title:"Booking details | Aara"};
export default async function BookingDetails({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{submitted?:string}>}){
 const {supabase,user}=await requireAccount("customer");const {id}=await params;const {submitted}=await searchParams;await refreshProposals(supabase);if(!z.uuid().safeParse(id).success)notFound();
 const {data:booking,error}=await supabase.from("booking_requests").select("*").eq("id",id).eq("customer_id",user.id).maybeSingle();if(error)throw new Error("Booking details are temporarily unavailable.");if(!booking)notFound();
 const snapshot=addressSchema.safeParse(booking.address_snapshot);if(!snapshot.success)throw new Error("Address details are temporarily unavailable.");const options=await bookingOptions(supabase);
 return <>{submitted==="1"&&<section className="booking-success" role="status"><p className="eyebrow">Request sent</p><h1>Booking request sent!</h1><p>Your request has been sent to your selected trainer.</p><p className="booking-reference">Reference: {booking.id}</p><div className="card-actions"><Button asChild><Link href="/account/bookings">View My Bookings</Link></Button><Button asChild variant="outline"><Link href="/services">Explore More Services</Link></Button></div></section>}<p className="eyebrow">Booking details</p><h1>{booking.service_name}</h1><p className="booking-status">{statusLabel(booking.status)}</p><p className="booking-reference">Reference: {booking.id}</p>{booking.status==="pending"&&<p>Your trainer is reviewing this request. The appointment is not confirmed yet.</p>}<div className="booking-grid"><section className="account-panel"><h2>Preferred visit</h2><p>{formatBookingDate(booking.preferred_date)}<br/>{options.find(o=>o.window_key===booking.time_window)?.label??booking.time_window} (India time)</p>{booking.customer_notes&&<p className="booking-notes">Your note: {booking.customer_notes}</p>}{booking.cancelled_at&&<p>Cancelled {new Date(booking.cancelled_at).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})}</p>}</section><section className="account-panel"><h2>Service address</h2><AddressSummary address={snapshot.data}/></section></div>{booking.status==="pending"&&<details className="account-panel"><summary>Cancel this request</summary><p>You can cancel while the request is awaiting review.</p><ActionForm action={cancelBooking} submit="Cancel Request"><input type="hidden" name="booking_id" value={booking.id}/><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>I want to cancel this request.</label></ActionForm></details>}<CustomerProposal client={supabase} booking={booking}/><DirectChoice client={supabase} booking={booking}/><nav className="card-actions" aria-label="Booking navigation"><Button asChild variant="outline"><Link href="/account/bookings">My Bookings</Link></Button><Link href="/professionals" className="text-link">Find another trainer</Link></nav></>;
}
