import { AuthPage } from "@/components/auth/auth-page";
import { requireAccount } from "@/lib/auth/session";
export const metadata = { title: "Update password | Aara", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  await requireAccount();
  const params = await searchParams;
  return <AuthPage mode="update" next={params.next} notice={params.notice} />;
}
