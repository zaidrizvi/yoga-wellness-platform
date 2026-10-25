"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import { FormFeedback } from "@/components/ui/form-feedback";
import type { FormState } from "@/lib/auth/validation";

export function ActionForm({ action, children, submit = "Save changes" }: { action: (state: FormState, form: FormData) => Promise<FormState>; children?: ReactNode; submit?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return <form action={formAction} className="account-form" aria-busy={pending}>{children}<FormFeedback error={state.error} success={state.success} />{state.url && <a href={state.url} target="_blank" rel="noreferrer" className="text-link">Open private document (expires shortly)</a>}<Button type="submit" disabled={pending}>{pending && <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{pending ? "Please wait..." : submit}</Button></form>;
}
