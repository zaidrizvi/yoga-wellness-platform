import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";
import { safeRedirect } from "@/lib/auth/redirect";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const protectedPath = path === "/account" || path.startsWith("/account/") || path === "/admin" || path.startsWith("/admin/") || path === "/book" || path.startsWith("/book/") || path === "/update-password";
  if (!user && protectedPath) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", safeRedirect(path + request.nextUrl.search));
    const redirected = NextResponse.redirect(login);
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    redirected.headers.set("Cache-Control", "private, no-store");
    return redirected;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)"] };
