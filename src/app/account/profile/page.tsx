import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { saveProfile } from "../actions";
export const metadata={title:"My profile | Aara"};
export default async function CustomerProfile(){
 const {supabase,user}=await requireAccount("customer");
 const {data:profile,error}=await supabase.rpc("ensure_own_profile",{new_full_name:typeof user.user_metadata.full_name==="string"?user.user_metadata.full_name.slice(0,120):""});
 return <><h1>My Profile</h1><p>{user.email}</p>{error&&<p role="alert">Your profile could not be loaded. Saving will retry.</p>}<ActionForm action={saveProfile} submit="Save profile"><label>Full name<input name="full_name" defaultValue={profile?.full_name??""} autoComplete="name" required maxLength={120}/></label><label>Phone number <span className="booking-help">Optional</span><input type="tel" name="phone" defaultValue={profile?.phone??""} autoComplete="tel" maxLength={20}/></label></ActionForm></>;
}
