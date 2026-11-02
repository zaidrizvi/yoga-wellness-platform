import { z } from "zod";
import { requireAccount } from "@/lib/auth/session";
import { marketplaceRpc,marketplacePending } from "@/lib/marketplace/rpc";
import { ActionForm } from "@/components/auth/action-form";
import { reviewApplication } from "@/app/professional/application-actions";
const location=z.object({id:z.uuid(),name:z.string(),district:z.string(),supported:z.boolean(),active:z.boolean(),updated_at:z.string().nullable(),source:z.string().nullable(),approved:z.boolean()});
export async function ApplicationLocationReview({application:a}:{application:{id:string;updated_at:string;state:string}}){
 const {supabase}=await requireAccount("admin");
 const result=await marketplaceRpc(supabase,"admin_application_localities",{p_application:a.id});
 if(marketplacePending(result.error))return <p role="status">Combined trainer and location review awaits deployment of the unified approval migration. No approval has been recorded.</p>;
 if(result.error)throw new Error("Requested locality review is temporarily unavailable.");
 const locations=z.array(location).parse(result.data),existing=a.state==="approved";
 return <section><h3>{existing?"Review previously submitted locations":"Review requested locations"}</h3><p>Authorize or exclude every locality. Approved locations are granted with the trainer decision.</p>
 {!locations.length&&<p role="status">No Delhi localities were submitted. Ask the trainer to update the application.</p>}
 <ActionForm action={reviewApplication} submit={existing?"Approve Locations":"Approve Trainer"}>
 <input type="hidden" name="application_id" value={a.id}/><input type="hidden" name="updated_at" value={a.updated_at}/>
 {existing?<input type="hidden" name="decision" value="approve_locations"/>:<label>Application decision<select name="decision" defaultValue="reject"><option value="reject">Request changes / reject</option><option value="approve" disabled={!locations.length}>Approve trainer and reviewed locations</option></select></label>}
 <fieldset className="form-section"><legend>Requested localities</legend>{locations.map(l=><section className="account-panel" key={l.id}><h4>{l.name} {l.district&&`(${l.district})`}</h4><p>{!l.supported?"Unsupported":l.active?"Available":"Needs locality review"}{l.approved?" · Already approved":""}</p>{l.source&&<a className="text-link" href={l.source} target="_blank" rel="noreferrer">Check source</a>}<input type="hidden" name="review_locality" value={l.id}/><input type="hidden" name={`locality_version_${l.id}`} value={l.updated_at??""}/><label>Decision for {l.name}<select name={`locality_decision_${l.id}`} defaultValue=""><option value="">Choose</option>{l.supported&&<option value="authorize">Authorize</option>}<option value="exclude">Exclude</option></select></label></section>)}</fieldset>
 <label>Feedback / excluded locality resolution (visible to applicant)<textarea name="feedback" required maxLength={1000}/></label>
 <label className="checkbox-label"><input type="checkbox" name="publish_profile" value="yes"/>Publish the reviewed profile if approved</label>
 <label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>I reviewed the trainer credentials and every locality decision, including any activation and exclusions.</label>
 {existing&&!locations.length?<p>No locations are available for remediation.</p>:null}
 </ActionForm></section>;
}
