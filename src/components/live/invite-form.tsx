"use client";
import {useActionState,useState} from "react";
import {createInvitation} from "@/app/invite/actions";
export function InviteForm({archiveId,archiveName}:{archiveId:string;archiveName:string}) {
  const [state,action,pending]=useActionState(createInvitation,{message:"",link:""});
  const [copyStatus,setCopyStatus]=useState("");
  const message=`Join me in ${archiveName} on Our Memory Archive — a shared collection of photographs, letters and recorded memories. Browse, add details and record a memory alongside a photo.\n\nOpen this invitation and use the invited email address to choose a password and join. No separate confirmation email is needed. The link expires in seven days.\n\n${state.link}`;
  async function copy(text:string) {
    try {await navigator.clipboard.writeText(text);setCopyStatus("Copied — ready to paste into an email or message.");}
    catch {setCopyStatus("Select and copy the invitation text below.");}
  }
  return <div className="auth-panel"><form action={action} onSubmit={()=>setCopyStatus("")}>
    <input type="hidden" name="archiveId" value={archiveId}/>
    <label className="field">Their email<input type="email" name="email" required maxLength={254} autoCapitalize="none"/></label>
    <button className="button" disabled={pending}>{pending?"Creating invitation…":"Create invitation"}</button>
  </form>
  {state.message&&<p role="status">{state.message}</p>}
  {state.link&&<div><label className="field">Invitation link<input readOnly value={state.link} onFocus={e=>e.currentTarget.select()}/></label>
    <button className="button" onClick={()=>copy(state.link)}>Copy invitation link</button>
    <label className="field">Invitation message<textarea readOnly rows={8} value={message} onFocus={e=>e.currentTarget.select()}/></label>
    <button className="button" onClick={()=>copy(message)}>Copy invitation message</button>
    {copyStatus&&<p role="status">{copyStatus}</p>}
    <p className="help-line">Send it by email or message. Only the invited email can join. New members can contribute photos, comments and voice memories.</p>
  </div>}</div>;
}
