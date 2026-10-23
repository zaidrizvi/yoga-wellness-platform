"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/auth/validation";

export function ActionForm({ action, children, submit = "Save changes" }: { action: (state: FormState, form: FormData) => Promise<FormState>; children?: ReactNode; submit?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="account-form">{children}<div aria-live="polite" aria-atomic="true">{state.error && <p role="alert" className="form-error">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}{state.url && <a href={state.url} target="_blank" rel="noreferrer" className="text-link">Open private document (expires shortly)</a>}</div><Button type="submit" disabled={pending}>{pending ? "Please wait..." : submit}</Button></form>;
}
