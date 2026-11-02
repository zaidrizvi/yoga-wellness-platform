import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth/session";
import { statusLabel } from "@/lib/fulfillment/validation";
import { Button } from "@/components/ui/button";
export const metadata={title:"Account overview | Aara"};
export default async function AccountOverview({searchParams}:{searchParams:Promise<{notice?:string}>}){
 const {supabase,user,role}=await requireAccount();if(role!=="customer")redirect(role==="professional"?"/professional":"/admin");
 const {notice}=await searchParams;
 const {data,error}=await supabase.from("booking_requests").select("id,service_name,status,preferred_date,created_at").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(6);
 if(error)throw new Error("Your booking overview is temporarily unavailable.");
 const rows=data??[],waiting=rows.filter(row=>["pending","assignment_proposed"].includes(row.status)).length,upcoming=rows.filter(row=>["confirmed","in_progress"].includes(row.status)).length;
 return <>{notice==="restricted"&&<p role="alert">That page is not available for this account.</p>}<h1>Overview</h1><div className="workspace-metrics"><article><h2>Upcoming</h2><p>{upcoming}</p><span>Confirmed appointments</span></article><article><h2>Awaiting response</h2><p>{waiting}</p><span>Open requests</span></article></div><section className="account-panel"><div className="section-heading"><h2>Recent bookings</h2><Link href="/account/bookings" className="text-link">View all</Link></div>{rows.length?<div className="booking-grid">{rows.slice(0,3).map(row=><article key={row.id}><p className="booking-status">{statusLabel(row.status)}</p><h3>{row.service_name}</h3><p>{new Date(row.preferred_date).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium"})}</p><Link href={`/account/bookings/${row.id}`} className="text-link">View details</Link></article>)}</div>:<p>No bookings yet.</p>}</section><Button asChild><Link href="/professionals">Find a Trainer</Link></Button></>;
}
