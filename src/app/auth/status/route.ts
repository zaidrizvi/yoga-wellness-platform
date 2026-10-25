import { NextResponse } from "next/server";
import { currentAccount } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const account = await currentAccount();
    let applicationPendingOrRejected = false;
    if (account?.role === "customer") {
      const { data, error } = await account.supabase.from("professional_applications").select("state").eq("applicant_id", account.user.id).maybeSingle();
      if (error) throw new Error("Application status unavailable");
      applicationPendingOrRejected = data?.state === "submitted" || data?.state === "rejected";
    }
    return NextResponse.json({ authenticated: !!account, role: account?.role ?? null, applicationPendingOrRejected }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ unavailable: true }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
