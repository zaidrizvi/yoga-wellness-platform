import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;
export async function savedAddresses(client: Client, owner: string) {
  const { data, error } = await client.from("customer_addresses").select("*").eq("customer_id", owner).order("created_at", { ascending: false });
  if (error) throw new Error("Saved addresses are temporarily unavailable.");
  return data;
}
export async function bookingOptions(client: Client) {
  const { data, error } = await client.rpc("booking_request_options");
  if (error || !data?.length) throw new Error("Booking preferences are temporarily unavailable.");
  return data;
}
export async function customerBookings(client: Client, owner: string, page = 1) {
  const { data, count, error } = await client.from("booking_requests").select("id,service_name,preferred_date,time_window,status,created_at", { count: "exact" }).eq("customer_id", owner).order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Booking history is temporarily unavailable.");
  return { bookings: data, count: count ?? 0 };
}
