import { z } from "zod";

export const uuid = z.uuid();
export const reason = z.string().trim().min(1).max(1000);
export const decision = z.enum(["accept", "decline"]);
export const indiaInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).refine(v => Number.isFinite(Date.parse(`${v}:00Z`)) && new Date(`${v}:00Z`).toISOString().slice(0,16) === v, "Choose a valid date and time").transform(v => `${v}:00+05:30`).refine(v => Number.isFinite(Date.parse(v)), "Choose a valid India date and time");
export const rupeePrice = z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/).transform(v => {
  const [whole, fraction = ""] = v.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}).refine(v => v <= 100000000, "Price exceeds the supported limit");
const optionalInteger = (max: number) => z.preprocess(v => v === "" || v == null ? null : Number(v), z.number().int().min(1).max(max).nullable());
export const offeringInput = z.object({
  service_id: uuid,
  offering_type: z.enum(["single_session", "recurring_package"]),
  title: z.string().trim().min(1).max(160), description: z.string().trim().max(4000),
  duration_minutes: z.coerce.number().int().min(1).max(1440), price: rupeePrice,
  total_sessions: optionalInteger(366), sessions_per_week: optionalInteger(21),
  package_duration_value: optionalInteger(365),
  package_duration_unit: z.preprocess(v => v === "" || v == null ? null : v, z.enum(["days", "weeks", "calendar_months"]).nullable()),
  delivery_notes: z.string().trim().max(1000),
}).superRefine((v, ctx) => {
  if (v.offering_type === "recurring_package") {
    if (!v.total_sessions || !v.package_duration_value || !v.package_duration_unit) ctx.addIssue({ code: "custom", message: "Include total sessions and an explicit package duration." });
    if (v.package_duration_unit === "weeks" && v.sessions_per_week && v.total_sessions !== v.package_duration_value! * v.sessions_per_week) ctx.addIssue({ code: "custom", message: "Weekly frequency multiplied by weeks must equal total sessions." });
  } else if ([v.total_sessions, v.sessions_per_week, v.package_duration_value, v.package_duration_unit].some(v => v !== null)) ctx.addIssue({ code: "custom", message: "Single sessions cannot contain package terms." });
});

export const weeklyWindow = z.object({ iso_weekday: z.coerce.number().int().min(1).max(7), start_time: z.string().regex(/^\d{2}:\d{2}$/), end_time: z.string().regex(/^\d{2}:\d{2}$/) }).refine(v => v.start_time < v.end_time, "End time must follow start time");

export const statusLabels: Record<string, string> = {
  pending: "Awaiting Trainer", awaiting_customer_agreement: "Awaiting Your Confirmation", assignment_proposed: "Awaiting Trainer",
  confirmed: "Confirmed", in_progress: "In progress", completed: "Completed", cancelled: "Cancelled", requires_rescheduling: "Requires reassignment",
  proposed: "Proposed", accepted: "Accepted", declined: "Declined", expired: "Expired", invalidated: "Eligibility changed", reassigned: "Reassigned",
};
export function statusLabel(status: string) { return statusLabels[status] ?? status.replaceAll("_", " "); }
export function money(paise: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100); }
export function indiaTime(instant: string) { return new Date(instant).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }); }

export const quoteTerms = z.object({
  professional_display_name: z.string(), title: z.string(), description: z.string(), offering_type: z.string(),
  duration_minutes: z.number(), price_minor: z.number(), currency: z.literal("INR"), price_basis: z.string(),
  total_sessions: z.number().nullable(), sessions_per_week: z.number().nullable(),
  package_duration_value: z.number().nullable(), package_duration_unit: z.string().nullable(),
  delivery_notes: z.string(), starts_at: z.string(), ends_at: z.string(), outside_preference: z.boolean(), scope: z.string(),
});
export const customerOffer = z.object({ assignment_id: uuid, state: z.string(), terms: quoteTerms, terms_hash: z.string(), customer_terms_state: z.string(), proposal_expires_at: z.string(), customer_agreed_at: z.string().nullable() });
