"use client";

import { useState } from "react";
import type { Tables } from "@/lib/supabase/database.types";
import { ActionForm } from "@/components/auth/action-form";
import { saveOffering } from "@/app/professional/actions";

type Service = { id: string; name: string; yoga: boolean };
export function OfferingForm({ services, revision, offering, initialKind = "single_session", baseline }: { services: Service[]; revision?: Tables<"professional_offering_revisions">; offering?: Tables<"professional_offerings">; initialKind?: string; baseline?: Tables<"professional_offering_revisions"> }) {
  const values = revision ?? baseline;
  const [kind, setKind] = useState(values?.offering_type ?? initialKind);
  const [service, setService] = useState(offering?.service_id ?? services[0]?.id ?? "");
  const yoga = services.find(s => s.id === service)?.yoga;
  if (!services.length) return <p>No published services are available. Ask an administrator to configure the catalog.</p>;
  return <ActionForm action={saveOffering} submit={revision ? "Save revision draft" : offering ? "Create revised draft" : "Create draft"}>
    {offering && <input type="hidden" name="offering_id" value={offering.id} />}
    {revision && <><input type="hidden" name="revision_id" value={revision.id} /><input type="hidden" name="updated_at" value={revision.updated_at} /></>}
    <fieldset className="form-section"><legend>Service details</legend>
    <label>Aara service<select name="service_id" value={service} onChange={e => { setService(e.target.value); if (!services.find(s => s.id === e.target.value)?.yoga) setKind("single_session"); }} required disabled={!!offering}>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    {offering && <input type="hidden" name="service_id" value={service} />}
    <label>Offering type<select name="offering_type" value={kind} onChange={e => setKind(e.target.value)}><option value="single_session">Single session / treatment</option><option value="recurring_package" disabled={!yoga}>Recurring Yoga package</option></select></label>
    <label>Title<input name="title" required maxLength={160} defaultValue={values?.title} /></label>
    <label>Service description<textarea name="description" maxLength={4000} defaultValue={values?.description} /></label>
    </fieldset><fieldset className="form-section"><legend>Session length & proposed price</legend><div className="form-row">
    <label>Minutes per session<input name="duration_minutes" type="number" required min={1} max={1440} step={1} defaultValue={values?.duration_minutes} /></label>
    <label>{kind === "recurring_package" ? "Total package price (INR)" : "Price per session (INR)"}<input name="price" type="number" required min="0" max="1000000" step="0.01" defaultValue={values ? (values.price_minor / 100).toFixed(2) : undefined} /></label>
    </div></fieldset>
    {kind === "recurring_package" && <fieldset className="form-section"><legend>Package terms</legend><label>Total sessions<input name="total_sessions" type="number" min={1} max={366} step={1} required defaultValue={values?.total_sessions ?? undefined} /></label><label>Sessions per week (optional)<input name="sessions_per_week" type="number" min={1} max={21} step={1} defaultValue={values?.sessions_per_week ?? undefined} /></label><label>Package duration<input name="package_duration_value" type="number" required min={1} max={365} step={1} defaultValue={values?.package_duration_value ?? undefined} /></label><label>Duration unit<select name="package_duration_unit" required defaultValue={values?.package_duration_unit ?? "weeks"}><option value="days">Days</option><option value="weeks">Weeks</option><option value="calendar_months">Calendar months</option></select></label><p className="booking-help">Four weeks is not a calendar month. For weekly plans, weeks × sessions per week must equal total sessions. No purchased credits are issued.</p></fieldset>}
    <label>Delivery / coverage details<textarea name="delivery_notes" maxLength={1000} defaultValue={values?.delivery_notes} /></label>
    <p className="booking-help">Saving creates a private draft. Submit the saved revision separately. New prices and material changes require administrator approval.</p>
  </ActionForm>;
}
