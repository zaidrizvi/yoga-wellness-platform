import { describe,expect,it } from "vitest";
import { indiaInstant,offeringInput,rupeePrice,customerOffer } from "@/lib/fulfillment/validation";

const base={service_id:"00000000-0000-4000-8000-000000000001",offering_type:"single_session",title:"Treatment",description:"Scope",duration_minutes:"60",price:"1250.25",delivery_notes:""};
describe("commercial and schedule validation",()=>{
  it("converts INR decimals to exact paise and rejects fractional paise",()=>{
    expect(rupeePrice.parse("1250.25")).toBe(125025);
    expect(rupeePrice.parse("0.01")).toBe(1);
    for(const value of ["-1","1.001","Infinity","1e3","1000000.01"])expect(rupeePrice.safeParse(value).success).toBe(false);
  });
  it("requires complete package terms and consistent weekly totals",()=>{
    expect(offeringInput.safeParse(base).success).toBe(true);
    const recurring={...base,offering_type:"recurring_package",total_sessions:"12",sessions_per_week:"3",package_duration_value:"4",package_duration_unit:"weeks"};
    expect(offeringInput.safeParse(recurring).success).toBe(true);
    expect(offeringInput.safeParse({...recurring,total_sessions:"10"}).success).toBe(false);
    expect(offeringInput.safeParse({...recurring,package_duration_unit:"calendar_months",package_duration_value:"1"}).success).toBe(true);
    expect(offeringInput.safeParse({...base,offering_type:"recurring_package"}).success).toBe(false);
    expect(offeringInput.safeParse({...base,total_sessions:"12"}).success).toBe(false);
  });
  it("converts local scheduling input explicitly to India offset and rejects impossible dates",()=>{
    expect(indiaInstant.parse("2026-11-01T09:00")).toBe("2026-11-01T09:00:00+05:30");
    expect(new Date(indiaInstant.parse("2026-11-01T09:00")).toISOString()).toBe("2026-11-01T03:30:00.000Z");
    for(const value of ["2026-02-31T09:00","2026-11-01T25:00","2026-11-01T09:00Z"])expect(indiaInstant.safeParse(value).success).toBe(false);
  });
  it("fails closed when a quote is incomplete instead of inventing terms",()=>{
    expect(customerOffer.safeParse({assignment_id:base.service_id,state:"proposed",terms:{price_minor:100}}).success).toBe(false);
  });
});
