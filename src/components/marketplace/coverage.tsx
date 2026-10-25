"use client";
import { useState } from "react";
import { ActionForm } from "@/components/auth/action-form";
import { LocationMultiSelect } from "./location-select";
import { requestLocalityAreas } from "@/app/marketplace-actions";
import type { Locality } from "@/lib/marketplace/contracts";
export function LocalityCoverage({localities,approved,requests}:{localities:Locality[];approved:string[];requests:{service_area_id:string;state:string;action:string}[]}){
 const [selected,setSelected]=useState<string[]>([]);
 const unavailable=selected.some(id=>!localities.find(l=>l.id===id)?.service_areas.length);
 function status(l:Locality){const mapped=l.service_areas.map(a=>a.id);return !mapped.length?"Unavailable — administrator activation required":mapped.every(id=>approved.includes(id))?"Approved":requests.some(r=>r.action==="add"&&mapped.includes(r.service_area_id)&&r.state==="submitted")?"Requested / pending approval":requests.some(r=>r.action==="add"&&mapped.includes(r.service_area_id)&&r.state==="rejected")?"Rejected / changes requested":"Configured — not requested";}
 const shown=localities.filter(l=>selected.includes(l.id)||l.service_areas.some(a=>approved.includes(a.id)||requests.some(r=>r.service_area_id===a.id)));
 return <><ActionForm action={requestLocalityAreas} submit="Request selected localities" disabled={!selected.length||selected.length>20||unavailable}><LocationMultiSelect options={localities} onSelectionChange={setSelected}/>{unavailable&&<p role="status">Remove unavailable selections before submitting. An administrator must first activate those localities. Selection alone does not submit a request.</p>}{selected.length>20&&<p role="alert">Choose at most 20 localities per request.</p>}<label className="checkbox-label"><input type="checkbox" name="confirmed" value="yes" required/>I can travel to all selected areas and request administrator approval for these exact localities.</label></ActionForm><h3>Locality approval status</h3><p>Select names to inspect their status. Unconfigured localities remain unavailable and cannot be requested or booked.</p><ul className="event-list">{shown.map(l=><li key={l.id}>{l.name} · {l.district} <span className="booking-status">{status(l)}</span></li>)}</ul></>;
}