import { requireAccount } from "@/lib/auth/session";
import { marketplacePending,marketplaceRpc } from "@/lib/marketplace/rpc";
export default async function AdminHome(){
  const {supabase}=await requireAccount("admin");const now=new Date().toISOString();
  const [applications,revisions,bookings,appointments,locations]=await Promise.all([
    supabase.from("professional_applications").select("id",{count:"exact",head:true}).eq("state","submitted"),
    supabase.from("professional_offering_revisions").select("id",{count:"exact",head:true}).eq("state","submitted"),
    supabase.from("booking_requests").select("id",{count:"exact",head:true}).eq("status","pending"),
    supabase.from("booking_assignments").select("id",{count:"exact",head:true}).in("state",["proposed","accepted"]).gte("starts_at",now),
    marketplaceRpc(supabase,"admin_professional_locality_requests"),
  ]);
  if([applications,revisions,bookings,appointments].some(x=>x.error))throw new Error("Admin summary is temporarily unavailable.");
  if(locations.error&&!marketplacePending(locations.error))throw new Error("Admin location summary is temporarily unavailable.");
  const locationCount=locations.error?null:Array.isArray(locations.data)?locations.data.length:0;
  return <><h1>Overview</h1><div className="workspace-metrics"><article><h2>Trainer applications</h2><p>{applications.count??0}</p><span>Pending review</span></article><article><h2>Service approvals</h2><p>{revisions.count??0}</p><span>Pending review</span></article><article><h2>Booking requests</h2><p>{bookings.count??0}</p><span>New requests</span></article><article><h2>Upcoming appointments</h2><p>{appointments.count??0}</p><span>Proposed or confirmed</span></article><article><h2>Location requests</h2><p>{locationCount??"—"}</p><span>{locationCount===null?"Migration pending":"Pending review"}</span></article></div></>;
}
