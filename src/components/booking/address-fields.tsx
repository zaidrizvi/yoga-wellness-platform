import type { Address } from "@/lib/booking/validation";
export function AddressFields({ address }: { address?: Address }) {
  return <fieldset className="address-fields"><legend className="sr-only">Address and contact details</legend>
    <label>Address label<input name="label" defaultValue={address?.label ?? "Home"} required maxLength={40} /></label>
    <label>Recipient name<input name="recipient_name" defaultValue={address?.recipient_name ?? ""} autoComplete="name" required maxLength={120} /></label>
    <label>Mobile number<input name="phone" type="tel" defaultValue={address?.phone ?? ""} autoComplete="tel" required maxLength={20} placeholder="10 digits or +91" /></label>
    <label>PIN code<input name="postal_code" defaultValue={address?.postal_code ?? ""} autoComplete="postal-code" inputMode="numeric" pattern="[1-9][0-9]{5}" required maxLength={6} /></label>
    <label>Address line 1<input name="address_line_1" defaultValue={address?.address_line_1 ?? ""} autoComplete="address-line1" required maxLength={200} /></label>
    <label>Address line 2 (optional)<input name="address_line_2" defaultValue={address?.address_line_2 ?? ""} autoComplete="address-line2" maxLength={200} /></label>
    <label>Locality / area<input name="locality" defaultValue={address?.locality ?? ""} required maxLength={120} /></label>
    <label>City<input name="city" defaultValue={address?.city ?? ""} autoComplete="address-level2" required maxLength={100} /></label>
    <label>State / union territory<input name="state" defaultValue={address?.state ?? ""} autoComplete="address-level1" required maxLength={100} /></label>
    <label>Landmark (optional)<input name="landmark" defaultValue={address?.landmark ?? ""} maxLength={200} /></label>
  </fieldset>;
}
