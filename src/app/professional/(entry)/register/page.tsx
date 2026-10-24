import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/session";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Apply as an Aara Professional" };
export default async function ProfessionalRegister() {
  const account=await currentAccount();
  if(account) redirect(account.role==="professional"?"/professional":account.role==="admin"?"/admin":"/professional/apply");
  return <SignupForm professional next="/professional/apply"/>;
}
