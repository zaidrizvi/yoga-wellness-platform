"use client";

import { useEffect, useRef } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

export function FormFeedback({ error, success }: { error?: string; success?: string }) {
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorMessage.current?.focus(); }, [error]);
  return <div className="form-feedback">
    {error && <p ref={errorMessage} tabIndex={-1} role="alert" className="form-error"><CircleAlert size={20} aria-hidden="true" /><span>{error}</span></p>}
    {success && <p role="status" className="form-success"><CircleCheck size={20} aria-hidden="true" /><span>{success}</span></p>}
  </div>;
}
