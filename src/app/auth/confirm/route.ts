import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token_hash = params.get("token_hash");
  const type = params.get("type");
  const code = params.get("code");
  const supabase = await createClient();
  let success = false;
  if (token_hash && (type === "email" || type === "signup" || type === "recovery")) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    success = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    success = !error;
  }
  const path = success ? safeRedirect(params.get("next"), type === "recovery" ? "/update-password" : "/account") : "/login?notice=invalid-link";
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
