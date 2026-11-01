"use client";
import {useId,useRef,useState} from "react";
import {useWorkspace} from "../workspace-provider";
import {useConversationCache} from "./conversation-cache";
import {FamilyConversation} from "./family-conversation";
import {can} from "@/lib/permissions";
import type {ArchiveItem} from "@/lib/types";
export function InlineConversation({item}:{item:ArchiveItem}) {
  const workspace=useWorkspace(),cache=useConversationCache();const region=useId(),button=useRef<HTMLButtonElement>(null);
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  if(!cache||workspace.mode!=="live"||item.commentCount===undefined||item.archivedAt||item.ingestionStatus!=="ready")return null;
  const archive=workspace.archive.id,key=`${archive}:${item.id}`,entry=cache.entries.get(key);
  const count=entry?entry.rows.filter(c=>!c.archived_at).length:item.commentCount;
  async function show() {
    setOpen(true);setBusy(true);setError("");
    try{await cache!.load(archive,item.id);}catch{setError("Conversation could not load. Please retry.");}finally{setBusy(false);}
  }
  function hide(){setOpen(false);button.current?.focus({preventScroll:true});}
  return <div className="inline-conversation">
    <button ref={button} type="button" className="conversation-link" aria-label={`${open?"Hide conversation":count?`${count} ${count===1?"comment":"comments"}`:"Add a comment"} on ${item.title}`} aria-expanded={open} aria-controls={region} onClick={()=>open?hide():void show()}>
      {open?<>Hide conversation<span aria-live="polite"> · {count} {count===1?"comment":"comments"}</span></>:count?`${count} ${count===1?"comment":"comments"}`:"Add a comment"}
    </button>
    <div id={region} hidden={!open} aria-busy={busy}>
      {busy&&!entry&&<p role="status">Opening conversation…</p>}
      {error&&<p role="alert">{error} <button type="button" className="subtle-button" onClick={()=>void show()}>Retry conversation</button></p>}
      {entry&&<fieldset className="conversation-content" disabled={busy||!!error}><FamilyConversation
        archiveId={archive} itemId={item.id} comments={entry.rows} profileId={workspace.profileId}
        names={Object.fromEntries(workspace.members.map(m=>[m.profileId,m.name]))}
        canComment={can(workspace.role,"commenter")} editor={can(workspace.role,"editor")} anchorId={region+"-thread"}/></fieldset>}
    </div>
  </div>;
}
