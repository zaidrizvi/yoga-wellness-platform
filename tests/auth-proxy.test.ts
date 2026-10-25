// @vitest-environment node
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/env", () => ({ getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "public-key" }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: (cookies: { name: string; value: string; options: { path: string } }[]) => void } }) => {
  options.cookies.setAll([{ name: "refreshed-cookie", value: "example", options: { path: "/" } }]);
  return { auth: { getUser: mocks.getUser } };
} }));
import { proxy } from "@/proxy";
it("allows anonymous direct-offering browsing but retains legacy request protection",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:null}});
  const response=await proxy(new NextRequest("http://localhost:3001/book/offering/60000000-0000-4000-8000-000000000001?area=60000000-0000-4000-8000-000000000002"));
  expect(response.headers.get("location")).toBeNull();
  const protectedResponse=await proxy(new NextRequest("http://localhost:3001/book/personal-yoga"));
  expect(new URL(protectedResponse.headers.get("location")!).pathname).toBe("/login");
});

it("preserves a protected destination and cookie updates on the login redirect", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
  const response = await proxy(new NextRequest("http://localhost:3001/account/professional?tab=profile"));
  const destination = new URL(response.headers.get("location")!);
  expect(destination.pathname).toBe("/login");
  expect(destination.searchParams.get("next")).toBe("/account/professional?tab=profile");
  expect(response.cookies.get("refreshed-cookie")?.value).toBe("example");
});
it("allows an authenticated account request through", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  const response = await proxy(new NextRequest("http://localhost:3001/account"));
  expect(response.headers.get("location")).toBeNull();
  expect(response.cookies.get("refreshed-cookie")?.value).toBe("example");
});

it.each(["/professional/register","/professional/login"])("allows public professional entry %s",async path=>{
  mocks.getUser.mockResolvedValue({data:{user:null}});
  const response=await proxy(new NextRequest(`http://localhost:3001${path}`));
  expect(response.headers.get("location")).toBeNull();
});
it("keeps the dedicated protected continuation and cookies",async()=>{
  mocks.getUser.mockResolvedValue({data:{user:null}});
  const response=await proxy(new NextRequest("http://localhost:3001/professional/apply"));
  const destination=new URL(response.headers.get("location")!);
  expect(destination.pathname).toBe("/professional/login");expect(destination.searchParams.get("next")).toBe("/professional/apply");expect(response.cookies.get("refreshed-cookie")?.value).toBe("example");
});
