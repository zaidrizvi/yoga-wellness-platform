import { AuthPage } from "@/components/auth/auth-page";
export const metadata = { title: "Password recovery | Aara", robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  return <AuthPage mode="recovery" next={params.next} notice={params.notice} />;
}
