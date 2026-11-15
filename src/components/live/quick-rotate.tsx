"use client";
import {useRef,useState} from "react";
import {RotateCcw,RotateCw,LoaderCircle} from "lucide-react";
import {rotateImage} from "@/lib/backend/image-actions";

export function QuickRotate({sourceId,rotation,onSaved}:{sourceId:string;rotation:number;onSaved:(rotation:number)=>void}) {
 const pending=useRef(false);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function rotate(turn:number) {
  if(pending.current)return;
  pending.current=true;setBusy(true);setMessage("");
  try {
   const result=await rotateImage(sourceId,turn,rotation);
   if(result.error)setMessage(result.error);
   else if(result.rotation!==undefined){onSaved(result.rotation);setMessage("Rotation saved");}
  } catch {setMessage("Could not save rotation. Please retry.");}
  finally {pending.current=false;setBusy(false);}
 }
 return <div className="quick-rotate" role="group" aria-label="Rotate image">
  <div className="quick-rotate-buttons">
   <button type="button" aria-label="Rotate left" title="Rotate left" disabled={busy} onClick={()=>void rotate(-90)}><RotateCcw size={20} aria-hidden="true"/></button>
   <button type="button" aria-label="Rotate right" title="Rotate right" disabled={busy} onClick={()=>void rotate(90)}><RotateCw size={20} aria-hidden="true"/></button>
  </div>
  <span role="status">{busy?<><LoaderCircle size={14} className="memory-spinner" aria-hidden="true"/> Saving…</>:message}</span>
 </div>;
}
