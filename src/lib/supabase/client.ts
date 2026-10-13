"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./env";

// Lazy: the public homepage does not call this or require credentials.
export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key);
}
