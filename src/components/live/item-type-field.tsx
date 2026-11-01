"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
import {changeItemKind} from "@/lib/backend/classification-actions";
export function ItemTypeField({archiveId,itemId,kind,editable}:{archiveId:string;itemId:string;kind:string;editable:boolean}) {
  const router=useRouter();const [selected,setSelected]=useState(kind),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  if(!editable||kind==="Audio")return null;
  return <details className="item-type-field"><summary>Change item type</summary><p>A file can be a letter, document, photograph or object. Its format does not decide what it is. Originals and other details stay unchanged.</p>
    <form onSubmit={async e=>{e.preventDefault();setBusy(true);setMessage("");try{const result=await changeItemKind(archiveId,itemId,selected,kind);setMessage(result.error||"Item type saved. Originals and other details unchanged.");if(!result.error)router.refresh();}catch{setMessage("Could not save. Please retry.");}finally{setBusy(false);}}}>
      <label className="field">Archive item type<select aria-label="Archive item type" value={selected} onChange={e=>setSelected(e.target.value)}>{["Photograph","Letter","Document","Object","Postcard","Certificate","Artwork","Other"].map(value=><option key={value}>{value}</option>)}</select></label>
      <button className="button" disabled={busy||selected===kind}>{busy?"Saving…":"Save item type"}</button>
    </form>{message&&<p role="status">{message}</p>}
  </details>;
}
