import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database,Json } from "@/lib/supabase/database.types";

export const pendingMigration="20261024020000_admin_operations_and_customer_history.sql";
type Operation="admin_coverage_overview"|"admin_coverage_history"|"admin_save_service_area"|"admin_team_lookup"|"admin_change_team_role"|"customer_booking_timeline";
type Response={data:unknown;error:{code?:string;message:string}|null};
// Narrow, explicit proposal contracts until approval/deployment permits actual
// schema-type regeneration. Existing generated Database types are not fabricated.
export async function operationsRpc(client:SupabaseClient<Database>,name:Operation,args:Record<string,Json|undefined>={}):Promise<Response>{
  const call=client.rpc.bind(client) as unknown as (name:Operation,args:Record<string,Json|undefined>)=>Promise<Response>;
  return call(name,args);
}
export function migrationUnavailable(error:{code?:string}|null){return !!error&&["PGRST202","42883"].includes(error.code??"");}
