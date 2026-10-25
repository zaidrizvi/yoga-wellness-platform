import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect,it,vi } from "vitest";
vi.mock("@/app/marketplace-actions",()=>({requestLocalityAreas:vi.fn()}));
vi.mock("@/lib/marketplace/data",()=>({marketplaceData:vi.fn()}));
vi.mock("@/lib/data/public",()=>({publishedServices:async()=>[]}));
vi.mock("@/components/auth/action-form",()=>({ActionForm:({children,disabled,submit}:{children:React.ReactNode;disabled:boolean;submit:string})=><form>{children}<button disabled={disabled}>{submit}</button></form>}));
import { LocalityCoverage } from "@/components/marketplace/coverage";
import { LocationSelect } from "@/components/marketplace/location-select";
import Directory from "@/app/professionals/page";
import { marketplaceData } from "@/lib/marketplace/data";
const id="60000000-0000-4000-8000-000000000001";
const unserved={id,name:"LOCAL unconfigured locality",district:"Local fixture",service_areas:[]};
it("lets anonymous UI visitors select and clear a catalog name with no service mapping",async()=>{
 const {container}=render(<LocationSelect options={[unserved]}/>);const user=userEvent.setup();await user.click(screen.getByRole("combobox"));await user.type(screen.getByRole("combobox"),"unconfigured");await user.keyboard("{ArrowDown}{Enter}");expect(container.querySelector('[name="area"]')).toHaveValue(id);await user.click(screen.getByRole("button",{name:"Clear selected location"}));expect(container.querySelector('[name="area"]')).toHaveValue("");
});
it("labels unconfigured trainer selections unavailable and prevents requesting them",async()=>{
 render(<LocalityCoverage localities={[unserved]} approved={[]} requests={[]}/>);const user=userEvent.setup();await user.click(screen.getByRole("combobox"));await user.keyboard("{Enter}");expect(screen.getByText(/Unavailable — mapping and activation required/)).toBeVisible();expect(screen.getByRole("button",{name:"Request selected localities"})).toBeDisabled();expect(screen.queryByText("Approved",{exact:true})).not.toBeInTheDocument();
});
it("shows pending configured coverage without implying approval",()=>{
 render(<LocalityCoverage localities={[{...unserved,service_areas:[{id,name:"LOCAL mapped delivery"}]}]} approved={[]} requests={[{service_area_id:id,state:"submitted",action:"add"}]}/>);expect(screen.getByText("Requested / pending approval")).toBeVisible();expect(screen.queryByText("Approved",{exact:true})).not.toBeInTheDocument();
});
it("renders the exact empty state for a discoverable unserved locality without requiring login",async()=>{
 vi.mocked(marketplaceData).mockResolvedValue({available:true,catalogAvailable:true,localities:[unserved],professionals:[],bundles:[],invalid:false});
 render(await Directory({searchParams:Promise.resolve({area:id})}));expect(screen.getByText("No professionals available in this area yet.")).toBeVisible();expect(screen.getByRole("combobox",{name:"Select your location (optional)"})).toBeEnabled();expect(screen.getByRole("combobox",{name:"Select your location (optional)"})).toHaveValue("LOCAL unconfigured locality — Local fixture");
});
