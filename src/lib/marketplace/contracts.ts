import { z } from "zod";
export const localitySchema = z.object({ id:z.uuid(),name:z.string(),district:z.string(),service_areas:z.array(z.object({id:z.uuid(),name:z.string()})) });
export type Locality=z.infer<typeof localitySchema>;
export const offeringSchema=z.object({offering_id:z.uuid(),revision_id:z.uuid(),professional_id:z.uuid(),display_name:z.string(),service_id:z.uuid(),service_slug:z.string(),service_name:z.string(),offering_type:z.string(),title:z.string(),description:z.string(),duration_minutes:z.number(),price_minor:z.number(),currency:z.literal("INR"),total_sessions:z.number().nullable(),sessions_per_week:z.number().nullable(),package_duration_value:z.number().nullable(),package_duration_unit:z.string().nullable(),delivery_notes:z.string()});
export type Offering=z.infer<typeof offeringSchema>;
export const professionalSchema=z.object({professional_id:z.uuid(),display_name:z.string(),biography:z.string(),qualifications_description:z.string(),experience_description:z.string(),approved_image_reference:z.string().nullable(),specializations:z.string(),localities:z.array(z.object({id:z.uuid(),name:z.string(),district:z.string()})),offerings:z.array(offeringSchema),weekly_hours:z.array(z.object({weekday:z.number(),from:z.string(),until:z.string()}))});
export type Professional=z.infer<typeof professionalSchema>;
export const bundleSchema=z.object({id:z.uuid(),title:z.string(),description:z.string(),locality_id:z.uuid(),locality_name:z.string(),district:z.string(),price_minor:z.number(),discount_terms:z.string(),starts_at:z.string(),ends_at:z.string(),items:z.array(offeringSchema.extend({quantity:z.number()}))});
export type Bundle=z.infer<typeof bundleSchema>;
export const previewSchema=z.object({review_hash:z.string(),terms:offeringSchema.extend({starts_at:z.string(),ends_at:z.string(),scope:z.string()})});
export const filtersSchema=z.object({area:z.uuid().optional(),service:z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),specialization:z.string().trim().max(120).optional(),max:z.coerce.number().finite().min(0).max(1000000).optional()});
export function marketplaceLink(path:string,query:Record<string,string|undefined>){const p=new URLSearchParams();for(const [k,v]of Object.entries(query))if(v)p.set(k,v);return path+(p.size?`?${p}`:"");}
export function directReturn(value:unknown){if(typeof value!=="string"||!/^\/book\/offering\/[0-9a-f-]{36}(?:\?|$)/i.test(value)||value.includes("\\"))return null;try{const u=new URL(value,"https://aara.invalid");return u.origin==="https://aara.invalid"?u.pathname+u.search:null;}catch{return null;}}
