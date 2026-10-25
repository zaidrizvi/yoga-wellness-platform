import { fireEvent,render,screen } from "@testing-library/react";
import { expect,it,vi } from "vitest";
vi.mock("@/app/auth/actions",()=>({authenticate:vi.fn(async()=>({confirmationEmail:"local-fixture@example.invalid"}))}));
import { AuthPage } from "@/components/auth/auth-page";
import { SignupForm } from "@/components/auth/signup-form";
const next="/book/offering/60000000-0000-4000-8000-000000000001?revision=60000000-0000-4000-8000-000000000002&area=60000000-0000-4000-8000-000000000003&start=2026-11-01T10%3A00";
function preservesContext(href:string|null){const continuation=new URL(href!,"https://aara.invalid").searchParams.get("next")!;const target=new URL(continuation,"https://aara.invalid"),original=new URL(next,"https://aara.invalid");expect(target.pathname).toBe(original.pathname);for(const key of ["revision","area","start"])expect(target.searchParams.get(key)).toBe(original.searchParams.get(key));}
it("keeps selected offering/area/time when switching login to signup",()=>{render(<AuthPage mode="login" next={next}/>);preservesContext(screen.getByRole("link",{name:"Create account"}).getAttribute("href"));});
it("keeps the same internal continuation after signup confirmation and on login links",async()=>{render(<SignupForm next={next}/>);preservesContext(screen.getByRole("link",{name:"Login"}).getAttribute("href"));fireEvent.submit(screen.getByRole("button",{name:"Create account"}).closest("form")!);preservesContext((await screen.findByRole("link",{name:"Already confirmed? Login"})).getAttribute("href"));});
it("does not carry external redirect destinations into auth links",()=>{render(<AuthPage mode="login" next="https://evil.invalid"/>);expect(screen.getByRole("link",{name:"Create account"})).toHaveAttribute("href","/signup");});
