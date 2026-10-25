"use client";
import { useId, useState } from "react";
import { ActionForm } from "@/components/auth/action-form";
import { uploadApplicationCredential } from "@/app/professional/application-actions";
import { maxCredentialSize } from "@/lib/professional-applications/validation";

export function ApplicantCredentialUpload({applicationId}:{applicationId:string}){
  const [error,setError]=useState("");
  const helpId=useId();
  return <ActionForm action={uploadApplicationCredential} submit="Upload private credential"><input type="hidden" name="application_id" value={applicationId}/><label>Supporting credential<input name="document" type="file" aria-describedby={helpId} aria-invalid={!!error} accept="application/pdf,image/jpeg,image/png" required onChange={e=>{const file=e.target.files?.[0];const invalid=file&&(!file.size||file.size>maxCredentialSize||!["application/pdf","image/jpeg","image/png"].includes(file.type))?"Choose a PDF, JPEG or PNG, up to 10 MB.":"";e.target.setCustomValidity(invalid);setError(invalid);}}/></label><p id={helpId} className="booking-help">PDF, JPEG or PNG, up to 10 MB. Documents are private and retained with your application.</p>{error&&<p className="form-error" role="alert">{error}</p>}<label className="checkbox-label"><input type="checkbox" name="retention_consent" value="yes" required/>I consent to private review and retention of this credential with my application history. Uploads cannot be overwritten or removed here; corrections use a new file.</label></ActionForm>;
}
