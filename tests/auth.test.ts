import { describe, expect, it, vi, beforeEach } from "vitest";
import { safeRedirect } from "@/lib/auth/redirect";
import { profileSchema, professionalSchema } from "@/lib/auth/validation";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ currentAccount: vi.fn(), createClient: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { requireAccount } from "@/lib/auth/session";
import { authenticate } from "@/app/auth/actions";
import { saveProfile, saveProfessional } from "@/app/account/actions";
import { publishService, reviewProfessional } from "@/app/admin/actions";

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}
function client(role = "customer", authenticated = true) {
  const single = vi.fn(async () => ({ data: { role }, error: null }));
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const update = vi.fn();
  const from = vi.fn(() => ({ select, update }));
  const rpc = vi.fn(async () => ({ data: {}, error: null }));
  const auth = { getUser: vi.fn(async () => ({ data: { user: authenticated ? { id: "owner", user_metadata: {} } : null }, error: null })), signInWithPassword: vi.fn(async () => ({ error: null })), signUp: vi.fn(), resetPasswordForEmail: vi.fn(async () => ({ error: { message: "Unknown user" } })) };
  const result = { from, rpc, auth, update, select, eq, single };
  mocks.createClient.mockResolvedValue(result);
  return result;
}
beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("redirect protection", () => {
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/%2fexample", "/%5cexample", "/a/..//evil.example", "/%252f%252fevil", "/%0aevil", "%", "javascript:alert(1)"])("rejects %s", value => expect(safeRedirect(value)).toBe("/"));
  it("preserves an internal destination", () => expect(safeRedirect("/account?notice=saved")).toBe("/account?notice=saved"));
});

describe("server identity and authorization (mocked Supabase)", () => {
  it("redirects unauthenticated protected operations", async () => {
    client("customer", false);
    await expect(requireAccount()).rejects.toThrow("REDIRECT:/login");
  });
  it("reads the current database role on each operation", async () => {
    client("admin");
    expect((await requireAccount("admin")).role).toBe("admin");
    client("customer");
    await expect(requireAccount("admin")).rejects.toThrow("REDIRECT:/account?notice=restricted");
  });
  it("fails closed when the role row is unavailable", async () => {
    const c = client(); c.single.mockResolvedValueOnce({ data: null as never, error: null });
    await expect(requireAccount()).rejects.toThrow("permissions are temporarily unavailable");
  });
  it("denies both administrator actions before invoking a mutation", async () => {
    const c = client();
    await expect(publishService({}, form({}))).rejects.toThrow("restricted");
    await expect(reviewProfessional({}, form({}))).rejects.toThrow("restricted");
    expect(c.update).not.toHaveBeenCalled(); expect(c.rpc).not.toHaveBeenCalled();
  });
  it("denies customer professional profile edits", async () => {
    const c = client();
    await expect(saveProfessional({}, form({}))).rejects.toThrow("restricted");
    expect(c.update).not.toHaveBeenCalled();
  });
  it("strips protected profile and professional fields", () => {
    expect(profileSchema.parse({ full_name: "A person", phone: "", role: "admin", id: "other" })).toEqual({ full_name: "A person", phone: "" });
    expect(professionalSchema.parse({ display_name: "A person", biography: "", qualifications_description: "", experience_description: "", public_visible: true, status: "verified" })).not.toHaveProperty("public_visible");
  });
  it("scopes profile updates to the verified caller", async () => {
    const c = client();
    c.update.mockReturnValue({ eq: vi.fn((column, id) => {
      expect(column).toBe("id"); expect(id).toBe("owner");
      return { select: () => ({ single: async () => ({ data: { id }, error: null }) }) };
    }) });
    const result = await saveProfile({}, form({ full_name: "Customer", phone: "", id: "victim", role: "admin" }));
    expect(result.success).toBeTruthy();
    expect(c.update).toHaveBeenCalledWith({ full_name: "Customer", phone: null });
  });
  it("login invokes Auth and rejects an external redirect", async () => {
    const c = client();
    await expect(authenticate({}, form({ mode: "login", email: "person@example.com", password: "correct-password", next: "//evil.example" }))).rejects.toThrow("REDIRECT:/");
    expect(c.auth.signInWithPassword).toHaveBeenCalledWith({ email: "person@example.com", password: "correct-password" });
  });
  it("recovery responses do not reveal registration", async () => {
    client(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    const result = await authenticate({}, form({ mode: "recovery", email: "person@example.com" }));
    expect(result.success).toMatch(/If this address/); expect(result.error).toBeUndefined();
  });
});

describe("focused login and signup destinations (mocked Supabase)", () => {
  it.each([undefined, "/account/professional?tab=profile"])("login destination: %s", async next => {
    client();
    await expect(authenticate({}, form({ mode: "login", email: "person@example.com", password: "correct-password", ...(next ? { next } : {}) }))).rejects.toThrow(`REDIRECT:${next ?? "/"}`);
  });
  it("returns confirmation state only after signup is accepted", async () => {
    const c = client(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3001");
    c.auth.signUp.mockResolvedValue({ data: { user: { id: "new-user" }, session: null }, error: null });
    const result = await authenticate({}, form({ mode: "signup", full_name: "A customer", email: "person@example.com", password: "a-valid-password", confirmation: "a-valid-password" }));
    expect(result).toEqual({ confirmationEmail: "person@example.com" });
    expect(c.rpc).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
  it("keeps rate-limited signup in an honest error state", async () => {
    const c = client(); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3001");
    c.auth.signUp.mockResolvedValue({ data: { user: null, session: null }, error: { status: 429 } });
    const result = await authenticate({}, form({ mode: "signup", full_name: "A customer", email: "person@example.com", password: "a-valid-password", confirmation: "a-valid-password" }));
    expect(result.error).toMatch(/Too many registration attempts/);
    expect(result.confirmationEmail).toBeUndefined();
  });
});
