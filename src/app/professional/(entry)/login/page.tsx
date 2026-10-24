import { redirect } from "next/navigation";
import { currentAccount } from "@/lib/auth/session";
import { safeRedirect } from "@/lib/auth/redirect";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata={title:"Professional login | Aara"};
export default async function ProfessionalLogin({searchParams}:{searchParams:Promise<{next?:string;notice?:string}>}){
  const params=await searchParams;
  const account=await currentAccount();
  if(account){
    const explicit=safeRedirect(params.next,"");
    if(explicit && !["/professional/login","/professional/register"].includes(explicit.split("?")[0])) redirect(explicit);
    if(account.role==="professional")redirect("/professional");
    if(account.role==="admin")redirect("/admin");
    const {data,error}=await account.supabase.from("professional_applications").select("id").eq("applicant_id",account.user.id).maybeSingle();
    if(error)throw new Error("Application status is temporarily unavailable.");
    redirect(data?"/professional/application-status":"/professional/apply");
  }
  return <AuthPage mode="login" professional next={params.next} notice={params.notice}/>;
}
