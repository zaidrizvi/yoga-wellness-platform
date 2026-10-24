import { ActionForm } from "@/components/auth/action-form";
import { openApplicationCredential } from "@/app/professional/application-actions";

export function ApplicationDocuments({applicationId,paths}:{applicationId:string;paths:string[]}){
  return paths.length?<ol className="application-documents">{paths.map((path,i)=><li key={path}><ActionForm action={openApplicationCredential} submit={`Open private credential ${i+1}`}><input type="hidden" name="application_id" value={applicationId}/><input type="hidden" name="filename" value={path.split("/").at(-1)??""}/></ActionForm></li>)}</ol>:<p>No supporting credentials are recorded.</p>;
}
