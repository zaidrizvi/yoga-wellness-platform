"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { submitBooking } from "@/app/book/actions";
import { AddressSummary } from "./address-summary";
import { formatBookingDate, preferredTimeError, type Address, type BookingOption } from "@/lib/booking/validation";
import type { FormState } from "@/lib/auth/validation";

export function BookingForm({ service, addresses, options, idempotencyKey, minDate, maxDate, selectedAddress }: {
  service: { id: string; slug: string; name: string }; addresses: Address[]; options: BookingOption[];
  idempotencyKey: string; minDate: string; maxDate: string; selectedAddress?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitBooking, {});
  const [requestKey] = useState(idempotencyKey);
  const [addressId, setAddressId] = useState(addresses.some(a => a.id === selectedAddress) ? selectedAddress! : addresses[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [windowKey, setWindowKey] = useState("");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const address = addresses.find(a => a.id === addressId);
  const option = options.find(o => o.window_key === windowKey);
  function reviewRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = preferredTimeError(date, windowKey, options);
    setValidationError(error);
    if (!error && address) setReview(true);
  }
  const addressLink = `/account/addresses?returnTo=${encodeURIComponent(`/book/${service.slug}`)}`;
  return <div className="booking-form"><p className="eyebrow" aria-live="polite">{review ? "Step 4 / Review your request" : "Steps 2 and 3 / Address and preferences"}</p>
    {review && address && option ? <form action={action} className="account-form booking-review">
      <h2>Review your request.</h2><h3>{service.name}</h3><AddressSummary address={address} /><p><strong>{formatBookingDate(date)}</strong><br />{option.label} (India time)</p>{notes && <p className="booking-notes">Your note: {notes}</p>}
      <input type="hidden" name="service_id" value={service.id} /><input type="hidden" name="address_id" value={addressId} /><input type="hidden" name="preferred_date" value={date} /><input type="hidden" name="time_window" value={windowKey} /><input type="hidden" name="customer_notes" value={notes} /><input type="hidden" name="idempotency_key" value={requestKey} />
      <p>Your request will be reviewed before your appointment is confirmed. Coverage, timing, and professional availability are subject to review. No slot is reserved and no payment is collected here.</p>
      <label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required disabled={pending} />I have reviewed these details and understand this is a pending request.</label>
      <div aria-live="polite">{state.error && <p role="alert" className="form-error">{state.error}</p>}</div>
      <Button type="submit" disabled={pending}>{pending ? "Submitting request..." : "Request Booking"}</Button><Button variant="outline" type="button" disabled={pending} onClick={() => setReview(false)}>Edit request details</Button><Link className="text-link" href="/account/bookings">Check my booking history</Link>
    </form> : <form onSubmit={reviewRequest} className="account-form">
      <h2>Where should we visit?</h2><label>Saved address<select value={addressId} onChange={event => setAddressId(event.target.value)} required><option value="" disabled>Choose an address</option>{addresses.map(a => <option value={a.id} key={a.id}>{a.label} - {a.locality}, {a.city}</option>)}</select></label>
      {address && <AddressSummary address={address} />}<Link className="text-link" href={addressLink}>Add or edit an address</Link>
      <h2>Your preferred timing.</h2><p>Choose a preference within {options[0].booking_horizon_days} days. These windows do not indicate available appointments.</p>
      <label>Preferred date<input type="date" value={date} onChange={event => setDate(event.target.value)} min={minDate} max={maxDate} required /></label>
      <label>Preferred time window (India time)<select value={windowKey} onChange={event => setWindowKey(event.target.value)} required><option value="" disabled>Choose a time window</option>{options.map(o => <option value={o.window_key} key={o.window_key}>{o.label}</option>)}</select></label>
      <label>Additional note (optional)<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} aria-describedby="booking-note-help" /></label><p id="booking-note-help" className="booking-help">Share visit preferences only. Please do not include sensitive medical records.</p>
      {validationError && <p role="alert" className="form-error">{validationError}</p>}<Button type="submit">Review request</Button>
    </form>}
  </div>;
}
