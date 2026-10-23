import { requireAccount } from "@/lib/auth/session";
import { ActionForm } from "@/components/auth/action-form";
import { publishService } from "../actions";

export const metadata = { title: "Service publication | Aara" };
export default async function ServicesAdmin() {
  const { supabase } = await requireAccount("admin");
  const { data, error } = await supabase.from("services").select("id,name,slug,is_published,is_active").order("display_order");
  if (error) throw new Error("Service management is temporarily unavailable.");
  return <><h1>Service publication.</h1><p>Publication controls public service visibility. Booking requests remain closed.</p>{data.length ? data.map(service => <article className="account-panel" key={service.id}><h2>{service.name}</h2><p>{service.is_published ? "Published" : "Unpublished"} / {service.is_active ? "Active" : "Inactive"}</p><ActionForm action={publishService} submit={service.is_published ? "Unpublish service" : "Publish service"}><input type="hidden" name="id" value={service.id} /><input type="hidden" name="published" value={String(!service.is_published)} /><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />Confirm this publication change</label></ActionForm></article>) : <p>No services are configured.</p>}</>;
}
