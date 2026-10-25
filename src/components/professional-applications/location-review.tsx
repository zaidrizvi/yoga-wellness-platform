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
 return <section><h3>{existing?"Approve previously submitted locations":"Review trainer and requested locations together"}</h3><p>Authorize each supported locality only after reviewing its identity and your ability to serve it. Authorization activates that exact locality if necessary and grants this trainer coverage. Exclude unsupported locations explicitly and explain the resolution in feedback. No postal mapping is created.</p>
 {!locations.length&&<p role="status">No named locality preferences were submitted. Request a corrected application, or use Coverage Management to review genuine locality names for an existing professional.</p>}
 <ActionForm action={reviewApplication} submit={existing?"Approve reviewed trainer locations":"Record trainer and locality decision"}>
 <input type="hidden" name="application_id" value={a.id}/><input type="hidden" name="updated_at" value={a.updated_at}/>
 {existing?<input type="hidden" name="decision" value="approve_locations"/>:<label>Application decision<select name="decision" defaultValue="reject"><option value="reject">Request changes / reject</option><option value="approve" disabled={!locations.length}>Approve trainer and reviewed locations</option></select></label>}
 <fieldset className="form-section"><legend>Requested localities</legend>{locations.map(l=><section className="account-panel" key={l.id}><h4>{l.name} {l.district&&`(${l.district})`}</h4><p>{!l.supported?"Unsupported: requires resolution":l.active?"Supported locality": "Requires review: not currently active / verified"}{l.approved?"; Trainer already has approved coverage":"; Trainer coverage not approved"}</p>{l.source&&<a className="text-link" href={l.source} target="_blank" rel="noreferrer">Review locality source</a>}<input type="hidden" name="review_locality" value={l.id}/><input type="hidden" name={`locality_version_${l.id}`} value={l.updated_at??""}/><label>Decision for {l.name}<select name={`locality_decision_${l.id}`} defaultValue=""><option value="">Not reviewed</option>{l.supported&&<option value="authorize">Authorize coverage; activate this locality if necessary</option>}<option value="exclude">Exclude this locality; explain in feedback</option></select></label></section>)}</fieldset>
 <label>Feedback / excluded locality resolution (visible to applicant)<textarea name="feedback" required maxLength={1000}/></label>
 <label className="checkbox-label"><input type="checkbox" name="publish_profile" value="yes"/>Publish the reviewed profile if approved</label>
 <label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>I reviewed the trainer credentials and every locality decision, including any activation and exclusions.</label>
 {existing&&!locations.length?<p>Use Coverage Management for named-locality review.</p>:null}
 </ActionForm></section>;
}
