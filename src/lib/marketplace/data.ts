import "server-only";
import { z } from "zod";
import { publicClient } from "@/lib/data/public";
import { marketplaceRpc,marketplacePending } from "./rpc";
import { localitySchema,professionalSchema,bundleSchema,filtersSchema } from "./contracts";
export async function activeLocalities(){const result=await marketplaceRpc(publicClient(),"marketplace_locations");if(result.error){if(marketplacePending(result.error))return {available:false,localities:[]};throw new Error("Locality selection is temporarily unavailable.");}return {available:true,localities:z.array(localitySchema).parse(result.data)};}
export async function catalogLocalities(){
  const result=await marketplaceRpc(publicClient(),"marketplace_catalog_locations");
  if(result.error){console.error("marketplace_catalog_locations failed",{code:result.error.code,message:result.error.message});if(marketplacePending(result.error))return {...await activeLocalities(),catalogAvailable:false};return {available:false,catalogAvailable:false,localities:[]};}
  return {available:true,catalogAvailable:true,localities:z.array(localitySchema).parse(result.data)};
}
export async function professionalData(id:string){
  const result=await marketplaceRpc(publicClient(),"marketplace_directory",{p_locality_id:null,p_service_slug:null,p_specialization:null,p_max_price:null,p_professional_id:id});
  if(result.error){console.error("marketplace_directory profile failed",{code:result.error.code,message:result.error.message});return {available:false,professional:null};}
  return {available:true,professional:z.array(professionalSchema).parse(result.data)[0]??null};
}
export async function marketplaceData(query:Record<string,string|undefined>={},professional?:string){
  const input=Object.fromEntries(Object.entries(query).filter(([,v])=>v!==""&&v!==undefined));
  const parsed=filtersSchema.safeParse(input);
  const locations=await catalogLocalities();
  if(!locations.available)return {...locations,professionals:[],bundles:[],invalid:false};
  if(!parsed.success||(parsed.data.area&&!locations.localities.some(l=>l.id===parsed.data.area)))return {...locations,professionals:[],bundles:[],invalid:true};
  const f=parsed.data;const client=publicClient();
  const [people,bundles]=await Promise.all([marketplaceRpc(client,"marketplace_directory",{p_locality_id:f.area??null,p_service_slug:f.service??null,p_specialization:f.specialization||null,p_max_price:f.max===undefined?null:Math.round(f.max*100),p_professional_id:professional??null}),marketplaceRpc(client,"marketplace_public_bundles",{p_locality:f.area??null})]);
  for(const r of [people,bundles])if(r.error){if(marketplacePending(r.error))return {...locations,available:false,professionals:[],bundles:[],invalid:false};throw new Error("Marketplace listings are temporarily unavailable.");}
  return {...locations,professionals:z.array(professionalSchema).parse(people.data),bundles:z.array(bundleSchema).parse(bundles.data),invalid:false};
}
