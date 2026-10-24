import "server-only";
import { requireAccount } from "@/lib/auth/session";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function requireApplicant(){
  const account=await requireAccount("customer");
  if(!account.user.email_confirmed_at)throw new Error("Confirm your email before applying.");
  return account;
}
export async function ownApplication(client:SupabaseClient<Database>,owner:string){
  const {data,error}=await client.from("professional_applications").select("*").eq("applicant_id",owner).maybeSingle();
  if(error)throw new Error("Your professional application is temporarily unavailable.");
  return data;
}
