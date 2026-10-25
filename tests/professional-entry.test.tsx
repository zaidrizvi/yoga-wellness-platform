import { fireEvent,render,screen } from "@testing-library/react";
import { beforeEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
const m=vi.hoisted(()=>({authenticate:vi.fn(),account:vi.fn(),redirect:vi.fn((path:string)=>{throw new Error(`REDIRECT:${path}`);})}));
vi.mock("@/app/auth/actions",()=>({authenticate:m.authenticate,logout:vi.fn()}));
vi.mock("@/lib/auth/session",()=>({requireAccount:m.account}));
vi.mock("next/navigation",()=>({redirect:m.redirect,usePathname:()=>"/professional",useSearchParams:()=>new URLSearchParams()}));
import { SignupForm } from "@/components/auth/signup-form";
import { AuthPage } from "@/components/auth/auth-page";
import ProfessionalLayout from "@/app/professional/(workspace)/layout";
beforeEach(()=>vi.clearAllMocks());
it("offers dedicated registration using the same Auth action and safe continuation",()=>{
  const {container}=render(<SignupForm professional next="/professional/apply"/>);
  expect(screen.getByRole("heading",{name:"Begin your professional application."})).toBeVisible();expect(screen.getByText(/remains a customer/)).toBeVisible();expect(container.querySelector('input[name="next"]')).toHaveValue("/professional/apply");expect(container.querySelector('input[name="mode"]')).toHaveValue("signup");
  expect(screen.getByRole("link",{name:/Already registered/})).toHaveAttribute("href","/professional/login");
});
it("keeps absent next empty on dedicated login so server database roles choose the destination",()=>{
  const {container}=render(<AuthPage mode="login" professional/>);expect(container.querySelector('input[name="next"]')).toHaveValue("");expect(container.querySelector('input[name="audience"]')).toHaveValue("professional");
});
it("shows dedicated login continuation only after accepted registration",async()=>{
  m.authenticate.mockResolvedValue({confirmationEmail:"applicant@example.com"});render(<SignupForm professional next="/professional/apply"/>);
  fireEvent.submit(screen.getByRole("button",{name:"Create account"}).closest("form")!);
  await screen.findByRole("heading",{name:"Check your inbox"});expect(screen.getByRole("link",{name:"Already confirmed? Login"})).toHaveAttribute("href","/professional/login?next=%2Fprofessional%2Fapply");expect(screen.getByText(/cannot confirm email delivery/)).toBeVisible();
});
it("redirects a pending customer away from all workspace children",async()=>{
  m.account.mockResolvedValue({role:"customer"});await expect(ProfessionalLayout({children:<p>Private tools</p>})).rejects.toThrow("REDIRECT:/professional/application-status");
});
it("renders the dedicated navigation for an authorized professional",async()=>{
  m.account.mockResolvedValue({role:"professional"});render(await ProfessionalLayout({children:<p>Practice overview</p>}));expect(screen.getByRole("link",{name:"Dashboard Overview"})).toHaveAttribute("href","/professional");expect(screen.getByRole("link",{name:"My Appointments"})).toHaveAttribute("href","/professional/appointments");
});
