import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function refreshProposals(client: SupabaseClient<Database>) {
  const { error } = await client.rpc("refresh_expired_booking_proposals");
  if (error) throw new Error("Appointment statuses could not be refreshed. Please try again.");
}
export function requireData<T>({ data, error }: { data: T; error: unknown }, message = "Information is temporarily unavailable."): NonNullable<T> {
  if (error || data == null) throw new Error(message);
  return data;
}
