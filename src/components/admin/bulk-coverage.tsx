"use client";
import { useState } from "react";
import { ActionForm } from "@/components/auth/action-form";
import { bulkCoverageDecision } from "@/app/admin/bulk-coverage-actions";
type Option={id:string;label:string;version?:string};
export function BulkCoverage({kind,options}:{kind:"areas"|"localities"|"requests";options:Option[]}){
 const [selected,setSelected]=useState<string[]>([]);
 if(!options.length)return <p>No eligible records for bulk {kind==="requests"?"review":"activation"}. Unmapped or unverified localities are excluded.</p>;
 const choices=options.slice(0,100);
 return <details className="account-panel"><summary>Bulk {kind==="requests"?"review pending coverage requests":"activate supported areas"}</summary><p>Review every selected record. Maximum 100 per batch. Each decision uses the existing authorized, audited operation. A batch stops on the first failure; earlier successful decisions remain saved.</p><ActionForm action={bulkCoverageDecision} submit={kind==="requests"?"Review selected requests":"Activate selected supported areas"} disabled={!selected.length}>
  <input type="hidden" name="kind" value={kind}/><label className="checkbox-label"><input type="checkbox" checked={selected.length===choices.length} onChange={e=>setSelected(e.target.checked?choices.map(o=>o.id):[])}/>Select all eligible records shown ({choices.length})</label>
  {choices.map(o=><label className="checkbox-label" key={o.id}><input type="checkbox" name="records" value={JSON.stringify({id:o.id,version:o.version})} checked={selected.includes(o.id)} onChange={e=>setSelected(e.target.checked?[...selected,o.id]:selected.filter(id=>id!==o.id))}/>{o.label}</label>)}
  {kind==="requests"&&<label>Decision<select name="decision" defaultValue="reject"><option value="reject">Reject selected requests</option><option value="approve">Approve selected requests</option></select></label>}
  <label>Reason / feedback<textarea name="reason" required maxLength={1000}/></label><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>I reviewed each selected record and confirm legitimate support and mappings. This does not bypass professional verification.</label>
 </ActionForm></details>;
}
