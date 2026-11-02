import { fireEvent,render,screen } from "@testing-library/react";
import { afterEach,describe,expect,it,vi } from "vitest";
import { ApprovedPhoto } from "@/components/marketplace/approved-photo";

describe("ApprovedPhoto",()=>{
  afterEach(()=>vi.unstubAllEnvs());

  it("renders an owner-scoped Supabase public profile photo",()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://staging.example.supabase.co");
    render(<ApprovedPhoto reference="public-professional-images/10000000-0000-4000-8000-000000000005/00000000-0000-4000-8000-000000000010.jpg" name="Aara Trainer"/>);
    const image=screen.getByRole("img",{name:"Profile photo of Aara Trainer"});
    expect(image.getAttribute("src")).toContain("staging.example.supabase.co/storage/v1/object/public/public-professional-images/");
  });

  it("falls back safely for an invalid or failed image",()=>{
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL","https://staging.example.supabase.co");
    const {rerender}=render(<ApprovedPhoto reference="https://attacker.example/photo.jpg" name="Aara Trainer"/>);
    expect(screen.getByText("No public photograph available")).toBeInTheDocument();
    rerender(<ApprovedPhoto reference="public-professional-images/owner/photo.jpg" name="Aara Trainer"/>);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.getByText("No public photograph available")).toBeInTheDocument();
  });
});
