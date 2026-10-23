import Link from "next/link";
import { ActionForm } from "./action-form";
import { authenticate } from "@/app/auth/actions";
import { safeRedirect } from "@/lib/auth/redirect";

export function AuthPage({ mode, next, notice }: { mode: "login" | "signup" | "recovery" | "update"; next?: string; notice?: string }) {
  const titles = { login: "Welcome back.", signup: "A little space for you.", recovery: "Find your way back.", update: "A fresh start." };
  return <section className="shell account-shell auth-layout"><div><p className="eyebrow">Your Aara account</p><h1>{titles[mode]}</h1><p>{mode === "signup" ? "Create your personal account. Booking requests are not yet open." : mode === "recovery" ? "Enter your email and we will send password recovery instructions." : mode === "update" ? "Choose a new password of at least 12 characters." : "Sign in to manage your personal information."}</p></div><div>{notice === "invalid-link" && <p role="alert" className="form-error">This link is invalid or expired. Request a new recovery email or sign in.</p>}
    <ActionForm action={authenticate} submit={mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : mode === "recovery" ? "Send recovery instructions" : "Update password"}>
      <input type="hidden" name="mode" value={mode} /><input type="hidden" name="next" value={safeRedirect(next)} />
      {mode === "signup" && <label>Full name<input name="full_name" autoComplete="name" required maxLength={120} /></label>}
      {mode !== "update" && <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
      {mode !== "recovery" && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 12} maxLength={128} /></label>}
      {(mode === "signup" || mode === "update") && <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>}
    </ActionForm><nav className="account-links" aria-label="Account options"><Link href="/login">Login</Link><Link href="/signup">Create account</Link><Link href="/forgot-password">Forgot password</Link><Link href="/account">My account</Link></nav></div></section>;
}
