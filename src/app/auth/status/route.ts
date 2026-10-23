import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await currentAccount();
    return NextResponse.json({ authenticated: !!account, role: account?.role ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
