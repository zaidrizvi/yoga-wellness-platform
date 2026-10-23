"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth/session";
import { bookingOptions } from "@/lib/booking/data";
import { bookingSchema, preferredTimeError } from "@/lib/booking/validation";
import type { FormState } from "@/lib/auth/validation";

export async function submitBooking(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("customer");
  const parsed = bookingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || form.get("confirmed") !== "yes") return { error: "Review and confirm the service, address, date, and time window." };
  // The RPC revalidates all rules atomically; no owner, snapshot, price or status is accepted here.
  // It also returns an exact retry's existing reference, even when its window has since passed.
  const { data, error } = await supabase.rpc("submit_booking_request", {
    p_service_id: parsed.data.service_id, p_address_id: parsed.data.address_id,
    p_preferred_date: parsed.data.preferred_date, p_time_window: parsed.data.time_window,
    p_idempotency_key: parsed.data.idempotency_key, p_customer_notes: parsed.data.customer_notes,
  });
  if (error || !data) {
    if (error?.code === "22023") {
      const timing = preferredTimeError(parsed.data.preferred_date, parsed.data.time_window, await bookingOptions(supabase));
      return { error: timing ?? "This service or request is no longer available. Review your details; if already submitted, check your booking history." };
    }
    return { error: "Your request could not be confirmed as saved. Retry with the same details, or check your booking history before starting a new request." };
  }
  revalidatePath("/account/bookings");
  redirect(`/account/bookings/${data}`);
}
export async function cancelBooking(_: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await requireAccount("customer");
  const id = z.uuid().safeParse(form.get("booking_id"));
  if (!id.success || form.get("confirmed") !== "yes") return { error: "Confirm that you want to cancel this pending request." };
  const { data, error } = await supabase.rpc("cancel_pending_booking_request", { p_booking_id: id.data });
  if (error || !data) return { error: "This request could not be cancelled. It may no longer be pending. Refresh to see its current status." };
  revalidatePath("/account/bookings"); revalidatePath(`/account/bookings/${id.data}`);
  return { success: "Your pending booking request has been cancelled." };
}
