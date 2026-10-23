import { fireEvent,render,screen } from "@testing-library/react";
import { expect,it,vi } from "vitest";
vi.mock("@/app/professional/actions",()=>({saveOffering:vi.fn(),saveSchedule:vi.fn()}));
import { OfferingForm } from "@/components/fulfillment/offering-form";
import { ScheduleForm } from "@/components/fulfillment/schedule-form";

it("exposes explicit package terms only for a recurring Yoga offering",()=>{
  render(<OfferingForm services={[{id:"yoga",name:"Yoga",yoga:true},{id:"therapy",name:"Therapy",yoga:false}]}/>);
  expect(screen.queryByLabelText("Total sessions")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Offering type"),{target:{value:"recurring_package"}});
  expect(screen.getByLabelText("Total sessions")).toBeRequired();expect(screen.getByLabelText("Duration unit")).toHaveValue("weeks");
  fireEvent.change(screen.getByLabelText("Aara service"),{target:{value:"therapy"}});
  expect(screen.getByLabelText("Offering type")).toHaveValue("single_session");expect(screen.queryByLabelText("Total sessions")).not.toBeInTheDocument();
});
it("lets a professional explicitly add and remove working windows without inventing hours",()=>{
  render(<ScheduleForm windows={[]}/>);
  expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"Add working window"}));expect(screen.getByLabelText("From")).toHaveValue("");
  fireEvent.click(screen.getByRole("button",{name:"Remove window"}));expect(screen.queryByLabelText("From")).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox")).toBeRequired();
});
