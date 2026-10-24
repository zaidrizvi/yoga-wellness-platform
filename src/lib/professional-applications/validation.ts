import { z } from "zod";

export const applicationId=z.uuid();
export const updatedAt=z.iso.datetime({offset:true});
export const applicationDetails=z.object({
  full_name:z.string().trim().max(120),
  phone:z.string().trim().refine(v=>!v||/^\+?[0-9 ()-]{7,20}$/.test(v),"Enter a valid contact phone number."),
  category_id:z.preprocess(v=>v===""||v==null?null:v,z.uuid().nullable()),
  qualifications:z.string().trim().max(3000),
  years_experience:z.preprocess(v=>v===""||v==null?null:Number(v),z.number().min(0).max(80).multipleOf(0.1).nullable()),
  biography:z.string().trim().max(3000),specializations:z.string().trim().max(1500),
  service_locations:z.string().trim().max(1000),
  postal_codes:z.string().max(200).transform(v=>[...new Set(v.split(/[\s,]+/).filter(Boolean))]).pipe(z.array(z.string().regex(/^[1-9][0-9]{5}$/, "Use six-digit Indian PIN codes.")).max(20)),
});
export const documentFilename=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png)$/);
export const maxCredentialSize=10*1024*1024;
export async function credentialKind(file:File){
  if(!file.size||file.size>maxCredentialSize)return null;
  const b=new Uint8Array(await file.slice(0,8).arrayBuffer());
  const type=b[0]===0x25&&b[1]===0x50&&b[2]===0x44&&b[3]===0x46?{extension:"pdf",mime:"application/pdf"}:b[0]===0xff&&b[1]===0xd8&&b[2]===0xff?{extension:"jpg",mime:"image/jpeg"}:[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)?{extension:"png",mime:"image/png"}:null;
  return type&&file.type===type.mime?type:null;
}
export function applicationStateLabel(state:string){return ({draft:"Draft",submitted:"Pending review",approved:"Approved",rejected:"Changes required"} as Record<string,string>)[state]??"Status unavailable";}
