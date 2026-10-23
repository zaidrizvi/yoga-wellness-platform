import { describe, expect, it } from "vitest";
import { addressSchema, bookingSchema, indiaDateTime, lastBookingDate, preferredTimeError, type BookingOption } from "@/lib/booking/validation";

export const options: BookingOption[] = [{ window_key: "morning", label: "Morning", start_time: "09:00:00", end_time: "12:00:00", booking_horizon_days: 60 }, { window_key: "afternoon", label: "Afternoon", start_time: "12:00:00", end_time: "15:00:00", booking_horizon_days: 60 }];
export const addressInput = { label: "Home", recipient_name: "A customer", phone: "+91 98765 43210", address_line_1: "Example address", address_line_2: "", locality: "Example locality", city: "Delhi", state: "Delhi", postal_code: "110001", landmark: "" };

describe("address and booking validation", () => {
  it("normalizes a mobile number and strips ownership/identity inputs", () => {
    const value = addressSchema.parse({ ...addressInput, customer_id: "victim", id: "other" });
    expect(value.phone).toBe("+919876543210");
    expect(value).not.toHaveProperty("customer_id"); expect(value).not.toHaveProperty("id");
  });
  it.each([{ postal_code: "010001" }, { postal_code: "11000" }, { recipient_name: " " }, { phone: "123" }, { address_line_1: "x".repeat(201) }])("rejects invalid address %j", change => {
    expect(addressSchema.safeParse({ ...addressInput, ...change }).success).toBe(false);
  });
  it("uses India date at the UTC day boundary", () => {
    expect(indiaDateTime(new Date("2026-10-23T20:00:00Z")).date).toBe("2026-10-24");
    expect(lastBookingDate("2026-12-15", 60)).toBe("2027-02-13");
  });
  it("rejects past windows, impossible dates, unknown windows and dates beyond the horizon", () => {
    const now = new Date("2026-10-23T05:00:00Z"); // 10:30 India time.
    expect(preferredTimeError("2026-10-23", "morning", options, now)).toBeTruthy();
    expect(preferredTimeError("2026-10-23", "afternoon", options, now)).toBeNull();
    expect(preferredTimeError("2026-02-30", "afternoon", options, now)).toBeTruthy();
    expect(preferredTimeError("2027-01-01", "morning", options, now)).toBeTruthy();
    expect(preferredTimeError("2026-10-24", "invented", options, now)).toBeTruthy();
  });
  it("does not accept client status, snapshot or price as booking inputs", () => {
    const value = bookingSchema.parse({ service_id: "00000000-0000-4000-8000-000000000001", address_id: "00000000-0000-4000-8000-000000000002", idempotency_key: "00000000-0000-4000-8000-000000000003", preferred_date: "2026-10-24", time_window: "morning", customer_notes: "", status: "confirmed", address_snapshot: {}, price: 1 });
    expect(value).not.toHaveProperty("status"); expect(value).not.toHaveProperty("address_snapshot"); expect(value).not.toHaveProperty("price");
  });
});
