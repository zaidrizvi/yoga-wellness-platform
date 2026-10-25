"use client";
import { useEffect,useId,useState } from "react";
import { Search,X } from "lucide-react";
import type { Locality } from "@/lib/marketplace/contracts";

export function LocationSelect({options,name="area",label="Select your location (optional)",defaultValue="",value,onChange,allowAll=true,required=false,disabled=false}:{options:Locality[];name?:string;label?:string;defaultValue?:string;value?:string;onChange?:(id:string)=>void;allowAll?:boolean;required?:boolean;disabled?:boolean}){
  const id=useId();const [selected,setSelected]=useState(defaultValue);const current=value??selected;
  const [open,setOpen]=useState(false);const [query,setQuery]=useState("");const [index,setIndex]=useState(0);
  const selectedOption=options.find(o=>o.id===current);
  const matched=options.filter(o=>`${o.name} ${o.district}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const choices=[...(allowAll?[{id:"",name:"All Delhi",district:""}]:[]),...matched.slice(0,50)];
  useEffect(()=>{if(open)document.getElementById(`${id}-option-${index}`)?.scrollIntoView?.({block:"nearest"});},[id,index,open,query]);
  function choose(next:string){setSelected(next);onChange?.(next);setOpen(false);setQuery("");setIndex(0);}
  return <div className="location-select" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setOpen(false);setQuery("");}}}>
    <label htmlFor={`${id}-input`}>{label}</label><div className="location-input"><Search size={18} aria-hidden="true"/>
      <input id={`${id}-input`} role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={open&&choices[index]?`${id}-option-${index}`:undefined} aria-describedby={`${id}-help`} autoComplete="off" placeholder={allowAll?"All Delhi":"Search locality or district"} value={open?query:selectedOption?`${selectedOption.name} — ${selectedOption.district}`:""} disabled={disabled} required={required&&!current}
        onFocus={()=>{setOpen(true);setQuery("");setIndex(0);}} onChange={e=>{setQuery(e.target.value);setOpen(true);setIndex(0);}}
        onKeyDown={e=>{if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setOpen(true);setIndex(i=>Math.max(0,Math.min(choices.length-1,i+(e.key==="ArrowDown"?1:-1))));}else if(e.key==="Enter"&&open){e.preventDefault();if(choices[index])choose(choices[index].id);}else if(e.key==="Escape"){e.preventDefault();setOpen(false);setQuery("");}else if(open&&(e.key==="Home"||e.key==="End")){e.preventDefault();setIndex(e.key==="Home"?0:Math.max(0,choices.length-1));}}}/>
      {current&&<button type="button" aria-label="Clear selected location" onClick={()=>choose("")}><X size={18} aria-hidden="true"/></button>}</div>
    <input type="hidden" name={name} value={current}/>
    {open&&<ul id={`${id}-list`} role="listbox" className="location-options">{choices.map((o,i)=><li id={`${id}-option-${i}`} role="option" aria-selected={o.id===current} className={i===index?"is-highlighted":""} key={o.id} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(o.id)}>{o.name}{o.district&&<span>{o.district}</span>}</li>)}{!matched.length&&<li role="presentation">No matching localities.</li>}</ul>}
    <p id={`${id}-help`} className="booking-help">{disabled?"Location selection is temporarily unavailable.":!options.length?"No locality options are available yet.":matched.length>50?`${matched.length} matches. Refine your search to find an area.`:"Search Delhi locality names. A listed name does not guarantee service availability."}</p>
  </div>;
}
export function LocationMultiSelect({options,name="locality_ids",label="Localities you can serve",defaultValues=[],onSelectionChange,help="Selecting an area does not grant professional coverage. Only active localities can be requested; an administrator must approve your coverage."}:{options:Locality[];name?:string;label?:string;defaultValues?:string[];onSelectionChange?:(ids:string[])=>void;help?:string}){
 const [selected,setSelected]=useState(defaultValues);
 function update(ids:string[]){setSelected(ids);onSelectionChange?.(ids);}
 return <fieldset className="form-section"><legend>{label}</legend><LocationSelect options={options.filter(o=>!selected.includes(o.id))} name="locality_picker" label="Search Delhi localities" value="" allowAll={false} onChange={id=>{if(id&&!selected.includes(id))update([...selected,id]);}} disabled={!options.length}/><ul className="location-chips">{selected.map(id=><li key={id}><input type="hidden" name={name} value={id}/><span>{options.find(o=>o.id===id)?.name??"Previously selected locality"}</span><button type="button" aria-label={`Remove ${options.find(o=>o.id===id)?.name??"locality"}`} onClick={()=>update(selected.filter(v=>v!==id))}><X size={16} aria-hidden="true"/></button></li>)}</ul><p className="booking-help">{help}</p></fieldset>;
}
