import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { savedAddresses } from "@/lib/booking/data";
import { ActionForm } from "@/components/auth/action-form";
import { AddressFields } from "@/components/booking/address-fields";
import { AddressSummary } from "@/components/booking/address-summary";
import { activeLocalities } from "@/lib/marketplace/data";
import { directReturn } from "@/lib/marketplace/contracts";
import { saveAddress, deleteAddress } from "./actions";

export const metadata = { title: "Saved addresses | Aara" };
export default async function AddressesPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { supabase, user } = await requireAccount("customer");
  const [addresses,locations] = await Promise.all([savedAddresses(supabase, user.id),activeLocalities()]);
  const { returnTo } = await searchParams;
  const back = directReturn(returnTo) || (returnTo && /^\/book\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(returnTo) ? returnTo : null);
  return <><p className="eyebrow">Your doorstep details</p><h1>Saved addresses.</h1><p>Keep your contact and location details ready for a request. Delhi NCR coverage is subject to review.</p>{back && <Link className="text-link" href={back}>Back to booking request</Link>}
    {!addresses.length && <p>You have no saved addresses yet. Add your first address below.</p>}
    <div className="booking-grid">{addresses.map(address => <article key={address.id} className="account-panel"><h2>{address.label}</h2><AddressSummary address={address} /><details><summary>Edit address</summary><ActionForm action={saveAddress}><input type="hidden" name="address_id" value={address.id} /><AddressFields address={address} localities={locations.localities} /></ActionForm></details><ActionForm action={deleteAddress} submit="Delete address"><input type="hidden" name="address_id" value={address.id} /><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required />Delete this saved address. Existing requests retain their submitted details.</label></ActionForm></article>)}</div>
    <article className="account-panel"><h2>Add an address</h2><ActionForm action={saveAddress} submit="Save address" disabled={!locations.localities.length}><input type="hidden" name="return_to" value={back ?? ""} /><AddressFields localities={locations.localities} /></ActionForm></article></>;
}
