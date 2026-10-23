import { z } from "zod";

export const password = z.string().min(12, "Use at least 12 characters.").max(128);
export const email = z.string().trim().email("Enter a valid email address.").max(254);
export const profileSchema = z.object({ full_name: z.string().trim().min(1).max(120), phone: z.string().trim().refine(v => !v || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a valid phone number.") });
export const professionalSchema = z.object({ display_name: z.string().trim().min(1).max(120), biography: z.string().trim().max(3000), qualifications_description: z.string().trim().max(3000), experience_description: z.string().trim().max(1500), specializations: z.string().trim().max(1500).default("") });
export type FormState = { error?: string; success?: string; url?: string; confirmationEmail?: string };
