import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "@/config/site";
import { getSupabaseConfig } from "@/lib/supabase/env";

afterEach(() => vi.unstubAllEnvs());

describe("deployment boundaries", () => {
  it("does not invent a canonical origin or accept unsafe URL protocols", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(getSiteUrl()).toBeUndefined();
    expect(getSiteUrl("not a domain")).toBeUndefined();
    expect(getSiteUrl("javascript:alert(1)")).toBeUndefined();
    expect(getSiteUrl("https://user:secret@example.com")).toBeUndefined();
    expect(getSiteUrl("https://example.com/ignored-path")).toEqual(new URL("https://example.com"));
  });

  it("reports missing Supabase configuration only when the integration is requested", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => getSupabaseConfig()).toThrow("Supabase is not configured");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test-project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    expect(getSupabaseConfig()).toEqual({ url: "https://test-project.supabase.co", key: "test-publishable-key" });
  });
});
