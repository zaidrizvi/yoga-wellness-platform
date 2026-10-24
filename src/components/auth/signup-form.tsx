"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { authenticate } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { safeRedirect } from "@/lib/auth/redirect";
import type { FormState } from "@/lib/auth/validation";

function CheckEmail({ email, correctEmail, professional, destination }: { email: string; correctEmail: () => void; professional: boolean; destination: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <section className="shell account-shell check-email" aria-labelledby="check-email-heading">
    <div className="check-email-icon"><Mail size={48} strokeWidth={1.25} aria-hidden="true" /></div>
    <p className="eyebrow">One more step</p>
    <h1 id="check-email-heading" ref={heading} tabIndex={-1}>Check your inbox</h1>
    <p>You must open your confirmation email and follow its link to activate your new account.</p>
    <p>Email address entered:<br /><strong className="confirmation-email">{email}</strong></p>
    <p>Check your spam or junk folder too. We cannot confirm email delivery. If you already have an account, you can log in instead.</p>
    <div className="account-links"><Link href={professional ? `/professional/login?next=${encodeURIComponent(destination)}` : "/login"} className="text-link">Already confirmed? Login</Link><button type="button" className="text-link" onClick={correctEmail}>Correct email address</button></div>
    <p className="check-email-note">This page will stay here while you check your email. Correcting your address lets you submit a new signup request; it does not change an existing account.</p>
  </section>;
}

function SignupFields({ initialEmail, onCorrectEmail, professional, destination }: { initialEmail: string; onCorrectEmail: (email: string) => void; professional: boolean; destination: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(authenticate, {});
  if (state.confirmationEmail) return <CheckEmail professional={professional} destination={destination} email={state.confirmationEmail} correctEmail={() => onCorrectEmail(state.confirmationEmail!)} />;
  return <section className="shell account-shell auth-layout"><div><p className="eyebrow">{professional ? "Join the Aara professional community" : "Your Aara account"}</p><h1>{professional ? "Begin your professional application." : "A little space for you."}</h1><p>{professional ? "Create an account, verify your email, then share your qualifications. Your account remains a customer until an administrator approves your application. Already registered? Sign in with your existing Aara account." : "Create your personal account. Booking requests are available for review."}</p></div><div>
    <form action={action} className="account-form">
      <input type="hidden" name="mode" value="signup" /><input type="hidden" name="next" value={destination}/>{professional && <input type="hidden" name="audience" value="professional"/>}
      <label>Full name<input name="full_name" autoComplete="name" required maxLength={120} /></label>
      <label>Email address<input name="email" type="email" defaultValue={initialEmail} autoComplete="email" required maxLength={254} /></label>
      <label>Password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <div aria-live="polite">{state.error && <p role="alert" className="form-error">{state.error}</p>}</div>
      <Button type="submit" disabled={pending}>{pending ? "Please wait..." : "Create account"}</Button>
    </form><nav className="account-links" aria-label="Account options"><Link href={professional ? "/professional/login" : "/login"}>{professional ? "Already registered? Professional login" : "Login"}</Link><Link href="/forgot-password">Forgot password</Link></nav>
  </div></section>;
}

export function SignupForm({ professional = false, next }: { professional?: boolean; next?: string }) {
  const destination = safeRedirect(next, professional ? "/professional/apply" : "/");
  const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState("");
  return <SignupFields professional={professional} destination={destination} key={revision} initialEmail={email} onCorrectEmail={value => { setEmail(value); setRevision(n => n + 1); }} />;
}
