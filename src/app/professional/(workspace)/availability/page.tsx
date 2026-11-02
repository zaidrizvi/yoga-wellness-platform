import { requireAccount } from "@/lib/auth/session";
import { requireData } from "@/lib/fulfillment/data";
import { indiaTime } from "@/lib/fulfillment/validation";
import { ScheduleForm } from "@/components/fulfillment/schedule-form";
import { ActionForm } from "@/components/auth/action-form";
import { deleteTimeOff, saveTimeOff } from "@/app/professional/actions";

export const metadata={title:"Availability | Aara"};
export default async function Availability(){
  const {supabase,user}=await requireAccount("professional");
  const [weekly,leave]=await Promise.all([
    supabase.from("professional_weekly_availability").select("*").eq("professional_id",user.id).order("iso_weekday").order("start_time"),
    supabase.from("professional_time_off").select("*").eq("professional_id",user.id).order("starts_at"),
  ]);
  const windows=requireData(weekly),timeOff=requireData(leave);
  return <><h1>Availability</h1><p>Set the weekly times when customers may request appointments.</p>
    <section className="account-panel"><h2>Weekly schedule</h2><ScheduleForm key={JSON.stringify(windows)} windows={windows}/></section>
    <section className="account-panel"><h2>Time off</h2><ActionForm action={saveTimeOff} submit="Add time off"><label>From (India time)<input type="datetime-local" name="starts_at" required/></label><label>Until (India time)<input type="datetime-local" name="ends_at" required/></label><label>Note (optional)<textarea name="reason" maxLength={500}/></label></ActionForm>
      {!timeOff.length&&<p>No time off added.</p>}{timeOff.map(item=><details key={item.id}><summary>{indiaTime(item.starts_at)} – {indiaTime(item.ends_at)}</summary>{item.reason&&<p>{item.reason}</p>}<ActionForm action={deleteTimeOff} submit="Remove"><input type="hidden" name="id" value={item.id}/><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>Confirm removal</label></ActionForm></details>)}</section></>;
}
