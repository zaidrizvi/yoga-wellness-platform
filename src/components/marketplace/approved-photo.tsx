"use client";

import Image from "next/image";
import { UserRound } from "lucide-react";
import { useState } from "react";

export function ApprovedPhoto({reference,name}:{reference:string|null;name:string}) {
  const [failed,setFailed]=useState(false);
  const valid=reference&&/^public-professional-images\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(reference);
  const base=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,"");
  const source=valid&&base?`${base}/storage/v1/object/public/${reference}`:null;
  return <div className="professional-avatar">{source&&!failed?
    <Image src={source} width={160} height={160} unoptimized alt={`Profile photo of ${name}`} onError={()=>setFailed(true)}/>:
    <><UserRound size={32} strokeWidth={1.25} aria-hidden="true"/><span className="sr-only">No public photograph available</span></>}
  </div>;
}
