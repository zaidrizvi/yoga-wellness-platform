import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect,it,vi } from "vitest";
vi.mock("@/lib/marketplace/data",()=>({marketplaceData:vi.fn()}));
vi.mock("@/lib/data/public",()=>({publishedServices:async()=>[]}));
import { LocationSelect } from "@/components/marketplace/location-select";
import Directory from "@/app/professionals/page";
import { marketplaceData } from "@/lib/marketplace/data";
const id="60000000-0000-4000-8000-000000000001";
const unserved={id,name:"LOCAL unconfigured locality",district:"Local fixture",service_areas:[]};
it("lets anonymous visitors select and clear a catalog locality",async()=>{
 const {container}=render(<LocationSelect options={[unserved]}/>);const user=userEvent.setup();await user.click(screen.getByRole("combobox"));await user.type(screen.getByRole("combobox"),"unconfigured");await user.keyboard("{ArrowDown}{Enter}");expect(container.querySelector('[name="area"]')).toHaveValue(id);await user.click(screen.getByRole("button",{name:"Clear selected location"}));expect(container.querySelector('[name="area"]')).toHaveValue("");
});
it("shows an honest empty state for an unavailable locality",async()=>{
 vi.mocked(marketplaceData).mockResolvedValue({available:true,catalogAvailable:true,localities:[unserved],professionals:[],bundles:[],invalid:false});
 render(await Directory({searchParams:Promise.resolve({area:id})}));expect(screen.getByText("No professionals available in this area yet.")).toBeVisible();expect(screen.getByRole("combobox",{name:"Select your location (optional)"})).toBeEnabled();
});
