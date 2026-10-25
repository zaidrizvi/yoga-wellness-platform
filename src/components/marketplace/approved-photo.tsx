"use client";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { useState } from "react";
export function ApprovedPhoto({reference,name}:{reference:string|null;name:string}){const [failed,setFailed]=useState(false);const valid=reference&&/^public-professional-images\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(reference);return <div className="professional-avatar">{valid&&!failed?<Image src={`/${reference}`} width={80} height={80} unoptimized alt={`Approved public photograph of ${name}`} onError={()=>setFailed(true)}/>:<><UserRound size={32} strokeWidth={1.25} aria-hidden="true"/><span className="sr-only">No public photograph available</span></>}</div>;}
