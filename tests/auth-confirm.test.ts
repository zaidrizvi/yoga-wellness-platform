// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
const auth = vi.hoisted(() => ({ verifyOtp: vi.fn(), exchangeCodeForSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
import { GET } from "@/app/auth/confirm/route";

beforeEach(() => {
  vi.clearAllMocks();
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
});

describe("confirmation destinations (mocked Supabase)", () => {
  it.each([
    ["token_hash=example&type=email", "/"],
    ["token_hash=example&type=email&next=https://evil.example", "/"],
    ["token_hash=example&type=email&next=/account", "/account"],
    ["token_hash=example&type=email&next=/professional/apply", "/professional/apply"],
    ["token_hash=example&type=recovery", "/update-password"],
    ["token_hash=example&type=recovery&next=/", "/update-password"],
    ["code=example&next=/update-password", "/update-password"],
    ["code=example", "/"],
  ])("routes %s to %s", async (query, path) => {
    const response = await GET(new NextRequest(`http://localhost:3001/auth/confirm?${query}`));
    expect(response.headers.get("location")).toBe(`http://localhost:3001${path}`);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("offers safe login after an invalid link", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { message: "Expired" } });
    const response = await GET(new NextRequest("http://localhost:3001/auth/confirm?token_hash=example&type=email"));
    expect(response.headers.get("location")).toBe("http://localhost:3001/login?notice=invalid-link");
  });
});
