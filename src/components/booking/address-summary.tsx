type Details = { recipient_name: string; phone: string; address_line_1: string; address_line_2: string; locality: string; city: string; state: string; postal_code: string; landmark: string };
export function AddressSummary({ address }: { address: Details }) {
  return <address className="address-summary"><strong>{address.recipient_name}</strong><br />{address.address_line_1}{address.address_line_2 && <>, {address.address_line_2}</>}<br />{address.locality}, {address.city}<br />{address.state} - {address.postal_code}{address.landmark && <><br />Landmark: {address.landmark}</>}<br />{address.phone}</address>;
}
