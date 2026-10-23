import { AuthPage } from "@/components/auth/auth-page";
export const metadata = { title: "Login | Aara", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  return <AuthPage mode="login" next={params.next} notice={params.notice} />;
}
