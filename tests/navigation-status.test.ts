// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ account: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ currentAccount: m.account }));
import { GET } from "@/app/auth/status/route";
beforeEach(() => { vi.clearAllMocks(); m.from.mockReturnValue(m); m.select.mockReturnValue(m); m.eq.mockReturnValue(m); m.maybeSingle.mockResolvedValue({ data: null, error: null }); });
it("returns guest navigation without querying applications", async () => { m.account.mockResolvedValue(null); expect(await (await GET()).json()).toMatchObject({ authenticated: false }); expect(m.from).not.toHaveBeenCalled(); });
it.each([null, "draft", "submitted", "rejected", "approved"])("uses only the signed-in customer's actual application: %s", async state => { m.account.mockResolvedValue({ role: "customer", user: { id: "owned-user" }, supabase: m }); m.maybeSingle.mockResolvedValue({ data: state ? { state } : null, error: null }); const response = await GET(); expect(await response.json()).toMatchObject({ role: "customer", applicationPendingOrRejected: state === "submitted" || state === "rejected" }); expect(m.eq).toHaveBeenCalledWith("applicant_id", "owned-user"); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); });
it.each(["professional", "admin"])("uses authoritative %s role without querying applications", async role => { m.account.mockResolvedValue({ role, supabase: m }); expect(await (await GET()).json()).toMatchObject({ role }); expect(m.from).not.toHaveBeenCalled(); });
it("fails closed when application state cannot be read", async () => { m.account.mockResolvedValue({ role: "customer", user: { id: "owned-user" }, supabase: m }); m.maybeSingle.mockResolvedValue({ error: { message: "Unavailable" } }); expect((await GET()).status).toBe(503); });
