import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { assets, getService, type Service } from "@/content/services";

// Public requests deliberately have no user session; admin cookies cannot broaden results.
function publicClient() {
  const { url, key } = getSupabaseConfig();
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) } });
}

export async function publishedServices() {
  const { data, error } = await publicClient().from("services").select("*,service_categories!inner(name,is_active)").eq("is_published", true).eq("is_active", true).eq("service_categories.is_active", true).order("display_order");
  if (error) throw new Error("Services are temporarily unavailable.");
  return data;
}

export async function publishedService(slug: string) {
  const { data, error } = await publicClient().from("services").select("*,service_categories!inner(name,is_active)").eq("slug", slug).eq("is_published", true).eq("is_active", true).eq("service_categories.is_active", true).maybeSingle();
  if (error) throw new Error("Service information is temporarily unavailable.");
  return data;
}

export type PublishedService = Awaited<ReturnType<typeof publishedServices>>[number];

export function servicePresentation(row: PublishedService): Service {
  const editorial = getService(row.slug);
  return {
    ...(editorial ?? { subtitle: "Personal wellbeing", detail: "At-home wellness", introduction: row.short_description, hero: assets.botanical, overview: row.detailed_description || row.short_description, expectations: [], suitability: "Please review the confirmed scope with the team before considering this service.", preparation: "Preparation details will be confirmed before appointments open.", faqs: [], related: [] }),
    slug: row.slug, title: row.name, description: row.short_description, category: row.service_categories.name,
    price: row.price_minor === null ? undefined : { amountInRupees: row.price_minor / 100, currency: "INR" },
    durationMinutes: row.duration_minutes ?? undefined,
  };
}

export async function publicProfessionals() {
  const { data, error } = await publicClient().rpc("list_public_professionals");
  if (error) throw new Error("Professional profiles are temporarily unavailable.");
  return data;
}
