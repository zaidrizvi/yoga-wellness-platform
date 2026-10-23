export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY before using data or authentication features.");
  }
  if (key.startsWith("sb_secret_")) throw new Error("Use a public Supabase publishable key.");
  if (key.split(".").length === 3) {
    try {
      const claims = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (claims.role === "service_role") throw new Error("Privileged credentials are not supported.");
    } catch (error) {
      if (error instanceof Error && error.message === "Privileged credentials are not supported.") throw error;
    }
  }
  return { url, key };
}
