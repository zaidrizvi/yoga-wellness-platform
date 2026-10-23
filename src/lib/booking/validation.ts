import { z } from "zod";
import type { Database, Tables } from "@/lib/supabase/database.types";

export type Address = Tables<"customer_addresses">;
export type Booking = Tables<"booking_requests">;
export type BookingOption = Database["public"]["Functions"]["booking_request_options"]["Returns"][number];
const required = (max: number) => z.string().trim().min(1, "This field is required.").max(max);
export const addressSchema = z.object({
  label: required(40), recipient_name: required(120),
  phone: z.string().trim().transform(value => {
    const clean = value.replace(/[ ()-]/g, "");
    return /^91[6-9][0-9]{9}$/.test(clean) ? `+${clean}` : clean;
  }).pipe(z.string().regex(/^(\+91)?[6-9][0-9]{9}$/, "Enter a valid Indian mobile number.")),
  address_line_1: required(200), address_line_2: z.string().trim().max(200),
  locality: required(120), city: required(100), state: required(100),
  postal_code: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a six-digit PIN code."),
  landmark: z.string().trim().max(200),
});
export const bookingSchema = z.object({
  service_id: z.uuid(), address_id: z.uuid(), idempotency_key: z.uuid(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_window: required(30), customer_notes: z.string().trim().max(2000),
});

export function indiaDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}:${part("second")}` };
}
export function lastBookingDate(today: string, horizon: number) {
  const day = new Date(`${today}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + horizon);
  return day.toISOString().slice(0, 10);
}
export function preferredTimeError(date: string, window: string, options: BookingOption[], now = new Date()): string | null {
  const option = options.find(o => o.window_key === window);
  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (!option || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return "Choose a valid date and preferred time window.";
  const current = indiaDateTime(now);
  if (date < current.date || date > lastBookingDate(current.date, option.booking_horizon_days) || `${date}T${option.start_time}` <= `${current.date}T${current.time}`) return `Choose a future window within ${option.booking_horizon_days} days. All times are India time.`;
  return null;
}
export function formatBookingDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeZone: "Asia/Kolkata" }).format(new Date(`${date}T00:00:00+05:30`));
}
