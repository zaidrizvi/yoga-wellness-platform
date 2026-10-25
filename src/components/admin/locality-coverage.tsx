"use client";
import { useState } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/auth/action-form";
import { LocationMultiSelect } from "@/components/marketplace/location-select";
import { approveLocalityCoverage } from "@/app/admin/locality-coverage-actions";
import type { Locality } from "@/lib/marketplace/contracts";
export type CoverageProfessional={id:string;name:string;requested_localities:string[];approved_localities:string[];approved_offerings:number;availability_windows:number};
export function AdminLocalityCoverage({localities,professionals}:{localities:Locality[];professionals:CoverageProfessional[]}){
 const [selected,setSelected]=useState("");const person=professionals.find(p=>p.id===selected);
 return <section className="account-panel"><h2>Approve coverage by locality</h2><p>Select the Delhi locality names you support. No PIN mapping is required. New applications review the trainer and requested locations together. Use this screen for later coverage changes or older trainers without named application preferences.</p><label>Trainer (optional)<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Activate localities only</option>{professionals.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
 {person&&<aside className="application-feedback"><h3>{person.name}: booking readiness</h3><ul><li>{person.approved_localities.length} approved localities</li><li>{person.approved_offerings} approved offerings</li><li>{person.availability_windows} saved weekly availability windows</li></ul>{!person.approved_offerings&&<p>They must submit an offering for <Link className="text-link" href="/admin/services/offerings">price/service approval</Link> before customers can request that offering.</p>}{!person.availability_windows&&<p>The trainer must save their weekly availability before an appointment can be accepted.</p>}</aside>}
 <ActionForm key={selected} action={approveLocalityCoverage} submit={person?"Activate localities & approve trainer coverage":"Activate selected localities"}>
 <input type="hidden" name="professional_id" value={selected}/><LocationMultiSelect options={localities} defaultValues={person?.requested_localities??[]} help="Select up to 20 locality names. Requested areas are suggestions only; nothing is activated or granted until you explicitly confirm this decision."/>
 <label>Decision reason<textarea name="reason" required maxLength={1000}/></label><label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>I reviewed the selected locality identities and confirm that we support these areas{person?` and authorize ${person.name} to serve them`:""}. This does not approve prices or override availability.</label>
 </ActionForm></section>;
}
