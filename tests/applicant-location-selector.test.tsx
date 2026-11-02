import { render,screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect,it,vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("@/app/professional/application-actions",()=>({saveApplication:vi.fn()}));
vi.mock("@/components/auth/action-form",()=>({ActionForm:({children}:{children:ReactNode})=><form>{children}</form>}));
import { ApplicationFields } from "@/components/professional-applications/application-fields";
it("allows an applicant to search, select multiple unmapped locality names and remove a selection",async()=>{
 const first="10399e28-d765-55d5-aed1-27b9459e88dc",second="9b4f6f1e-37a4-56b5-b139-9d462ccd1a2d";
 const {container}=render(<ApplicationFields application={null} categories={[]} localities={[
  {id:first,name:"Saket",district:"SOUTH",service_areas:[]},
  {id:second,name:"Hauz Khas",district:"SOUTH",service_areas:[]},
 ]}/>);
 const user=userEvent.setup(),search=screen.getByRole("combobox",{name:"Search Delhi localities"});
 expect(search).toBeEnabled();await user.type(search,"Saket");await user.keyboard("{Enter}");
 await user.click(search);await user.type(search,"Hauz");await user.keyboard("{Enter}");
 expect(Array.from(container.querySelectorAll<HTMLInputElement>('[name="locality_ids"]')).map(input=>input.value)).toEqual([first,second]);
 await user.click(screen.getByRole("button",{name:"Remove Saket"}));expect(container.querySelectorAll('[name="locality_ids"]')).toHaveLength(1);
 expect(screen.getByText(/administrator will review these with your application/)).toBeVisible();
});
