import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database,Json } from "@/lib/supabase/database.types";
export const marketplaceMigrations=["20261025090000_marketplace_localities_direct_booking_and_bundles.sql","20261025090001_delhi_locality_catalog.sql"];
type Operation="admin_approve_locality_coverage"|"admin_locality_coverage_overview"|"marketplace_catalog_locations"|"save_application_localities"|"admin_marketplace_audit"|"admin_marketplace_bundles"|"marketplace_locations"|"marketplace_directory"|"marketplace_booking_preview"|"marketplace_public_bundles"|"admin_marketplace_localities"|"admin_save_marketplace_locality"|"request_locality_coverage"|"save_locality_address"|"allow_booking_alternative"|"admin_save_marketplace_bundle"|"submit_direct_booking";
export async function marketplaceRpc(client:SupabaseClient<Database>,operation:Operation,args:Record<string,Json|undefined>={}){
  const rpc=client.rpc.bind(client) as unknown as (operation:Operation,args:Record<string,Json|undefined>)=>Promise<{data:unknown;error:{code?:string;message:string}|null}>;
  return rpc(operation,args);
}
export function marketplacePending(error:{code?:string}|null){return !!error&&["PGRST202","PGRST205","42883","42P01"].includes(error.code??"");}
