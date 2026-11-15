"use client";
import { ImageFraming } from "../image-framing";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { rotateImage } from "@/lib/backend/image-actions";
export function ImageOptions({sourceId,rotation=0,editable}:{sourceId:string;rotation?:number;editable:boolean}) {
  const [framing,setFraming]=useState(false);
  const router=useRouter();const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  if(!editable)return null;
  async function rotate(turn:number) {
    setBusy(true);setMessage("");
    try {const result=await rotateImage(sourceId,turn,rotation);setMessage(result.error||"Image rotated. Original unchanged.");if(!result.error)router.refresh();}
    catch {setMessage("Rotation not saved. Please retry.");}finally{setBusy(false);}
  }
  return <details className="image-options"><summary>Image options</summary>
    <div className="import-actions"><button className="subtle-button" disabled={busy} onClick={()=>void rotate(-90)}>Rotate left</button><button className="subtle-button" disabled={busy} onClick={()=>void rotate(90)}>Rotate right</button></div>
    <button type="button" className="subtle-button" disabled={busy} onClick={()=>setFraming(true)}>Straighten and crop</button>
    {framing&&<ImageFraming sourceId={sourceId} onClose={()=>setFraming(false)}/>}
    {message&&<p role="status">{message}</p>}
  </details>;
}
