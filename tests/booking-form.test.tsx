import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Address, BookingOption } from "@/lib/booking/validation";
import { indiaDateTime, lastBookingDate } from "@/lib/booking/validation";
const mocks = vi.hoisted(() => ({ submitBooking: vi.fn() }));
vi.mock("@/app/book/actions", () => ({ submitBooking: mocks.submitBooking }));
import { BookingForm } from "@/components/booking/booking-form";

it("reviews actual selected address/preferences and retains its key across uncertain retries", async () => {
  mocks.submitBooking.mockResolvedValue({ error: "Request could not be confirmed as saved." });
  const today = indiaDateTime().date;
  const tomorrow = lastBookingDate(today, 1);
  const address: Address = { id: "00000000-0000-4000-8000-000000000002", customer_id: "owner", label: "Home", recipient_name: "Customer", phone: "9876543210", address_line_1: "Example address", address_line_2: "", locality: "Area", city: "Delhi", state: "Delhi", postal_code: "110001", landmark: "", created_at: "2026-10-23T00:00:00Z", updated_at: "2026-10-23T00:00:00Z" };
  const options: BookingOption[] = [{ window_key: "morning", label: "Morning", start_time: "09:00:00", end_time: "12:00:00", booking_horizon_days: 60 }];
  const props = { service: { id: "00000000-0000-4000-8000-000000000001", slug: "personal-yoga", name: "Personal Yoga" }, addresses: [address], options, idempotencyKey: "original-key", minDate: today, maxDate: lastBookingDate(today, 60) };
  const { rerender } = render(<BookingForm {...props} />);
  const user = userEvent.setup();
  fireEvent.change(screen.getByLabelText("Preferred date"), { target: { value: tomorrow } });
  await user.selectOptions(screen.getByLabelText("Preferred time window (India time)"), "morning");
  await user.click(screen.getByRole("button", { name: "Review request" }));
  expect(mocks.submitBooking).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Review your request." })).toBeVisible();
  expect(screen.getByText(/reviewed before your appointment is confirmed/)).toBeVisible();
  if (!(screen.getByRole("checkbox") as HTMLInputElement).checked) await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Request Booking" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
  rerender(<BookingForm {...props} idempotencyKey="new-server-prop" />);
  if (!(screen.getByRole("checkbox") as HTMLInputElement).checked) await user.click(screen.getByRole("checkbox"));
  await user.click(screen.getByRole("button", { name: "Request Booking" }));
  expect(mocks.submitBooking).toHaveBeenCalledTimes(2);
  for (const call of mocks.submitBooking.mock.calls) {
    const payload = call[1] as FormData;
    expect(payload.get("idempotency_key")).toBe("original-key");
    expect(payload.get("address_id")).toBe(address.id);
    expect(payload.get("preferred_date")).toBe(tomorrow);
    expect(payload.get("status")).toBeNull();
  }
});
