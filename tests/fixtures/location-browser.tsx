// LOCAL browser fixture only. These IDs do not create geographic or hosted data.
import { createRoot } from "react-dom/client";
import { LocationSelect,LocationMultiSelect } from "../../src/components/marketplace/location-select";
const options=[{id:"60000000-0000-4000-8000-000000000001",name:"LOCAL fixture area",district:"North test grouping",service_areas:[]},{id:"60000000-0000-4000-8000-000000000002",name:"LOCAL fixture area",district:"South test grouping",service_areas:[]}];
createRoot(document.getElementById("location-fixture")!).render(<main className="shell account-shell"><h1>Local selector verification</h1><form className="account-form" onSubmit={event=>event.preventDefault()}><LocationSelect options={options}/><LocationMultiSelect options={options}/><button type="submit">Apply selection</button></form></main>);
