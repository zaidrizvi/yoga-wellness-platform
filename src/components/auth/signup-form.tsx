"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { authenticate } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { FormFeedback } from "@/components/ui/form-feedback";
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
    <div className="account-links"><Link href={professional ? `/professional/login?next=${encodeURIComponent(destination)}` : destination==="/"?"/login":`/login?next=${encodeURIComponent(destination)}`} className="text-link">Already confirmed? Login</Link><button type="button" className="text-link" onClick={correctEmail}>Correct email address</button></div>
    <p className="check-email-note">This page will stay here while you check your email. Correcting your address lets you submit a new signup request; it does not change an existing account.</p>
  </section>;
}

function SignupFields({ initialEmail, onCorrectEmail, professional, destination }: { initialEmail: string; onCorrectEmail: (email: string) => void; professional: boolean; destination: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(authenticate, {});
  if (state.confirmationEmail) return <CheckEmail professional={professional} destination={destination} email={state.confirmationEmail} correctEmail={() => onCorrectEmail(state.confirmationEmail!)} />;
  return <section className="shell account-shell auth-layout"><div><p className="eyebrow">{professional ? "For wellness professionals" : "Your Aara account"}</p><h1>{professional ? "Join Aara as a Professional" : "Create your account"}</h1><p>{professional ? "Create your account and apply to offer wellness services." : "Save your details and request appointments with your chosen trainer."}</p></div><div>
    <form action={action} className="account-form" aria-busy={pending}>
      <input type="hidden" name="mode" value="signup" /><input type="hidden" name="next" value={destination}/>{professional && <input type="hidden" name="audience" value="professional"/>}
      <label>Full name<input name="full_name" autoComplete="name" required maxLength={120} /></label>
      <label>Email address<input name="email" type="email" defaultValue={initialEmail} autoComplete="email" required maxLength={254} /></label>
      <div className="form-field"><label>Password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="signup-password-help" /></label><p className="booking-help" id="signup-password-help">Use at least 12 characters.</p></div>
      <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
      <FormFeedback error={state.error} />
      <Button type="submit" disabled={pending}>{pending ? "Please wait..." : "Create account"}</Button>
    </form><nav className="account-links" aria-label="Account options"><Link href={professional ? "/professional/login" : destination==="/"?"/login":`/login?next=${encodeURIComponent(destination)}`}>{professional ? "Already registered? Professional login" : "Login"}</Link><Link href="/forgot-password">Forgot password</Link></nav>
  </div></section>;
}

export function SignupForm({ professional = false, next }: { professional?: boolean; next?: string }) {
  const destination = safeRedirect(next, professional ? "/professional/apply" : "/");
  const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState("");
  return <SignupFields professional={professional} destination={destination} key={revision} initialEmail={email} onCorrectEmail={value => { setEmail(value); setRevision(n => n + 1); }} />;
}
