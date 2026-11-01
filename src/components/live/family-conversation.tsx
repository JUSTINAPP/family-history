"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {conversationAction} from "@/lib/backend/quick-actions";
import {commentThreads,type FamilyComment} from "@/lib/conversation";
import {useConversationCache} from "./conversation-cache";
export function FamilyConversation({archiveId,itemId,comments,profileId,names,canComment,editor,unavailable=false,anchorId="family-conversation"}:{
  archiveId:string;itemId:string;comments:FamilyComment[];profileId:string;names:Record<string,string>;canComment:boolean;editor:boolean;unavailable?:boolean;anchorId?:string;
}) {
  const router=useRouter(),cache=useConversationCache(),key=`${archiveId}:${itemId}`;
  const [local,setLocal]=useState(comments),[reply,setReply]=useState<FamilyComment|null>(null),[editing,setEditing]=useState<FamilyComment|null>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");const replyButton=useRef<HTMLButtonElement|null>(null);
  const rows=cache?.entries.get(key)?.rows||local;
  useEffect(()=>{if(cache&&!cache.entries.has(key)&&!unavailable)cache.write(key,comments);},[cache,key,comments,unavailable]);
  function saved(comment:FamilyComment) {
    if(cache)cache.upsert(key,comment);
    else setLocal(prior=>[...prior.filter(c=>c.id!==comment.id),comment].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)));
  }
  async function change(comment:FamilyComment,action:string,body="") {
    const data=new FormData();data.set("action",action);data.set("commentId",comment.id);data.set("body",body);data.set("revision",String(comment.revision));
    setBusy(true);setMessage("");
    try {
      const result=await conversationAction(archiveId,itemId,data);
      if(result.error)setMessage(result.error);
      else if(result.comment) {
        saved(result.comment);setEditing(null);setMessage(action==="promote"?"Copied to recollections. The conversation stays here.":"Comment updated.");
        // This deliberate archival action also updates the separate server-rendered recollection section.
        if(action==="promote")router.refresh();
      }
    } catch {setMessage("Could not update this comment. Please retry.");}finally{setBusy(false);}
  }
  function composer(parent?:FamilyComment) {
    return <CommentComposer key={`${itemId}:${parent?.id||"root"}`} archiveId={archiveId} itemId={itemId} parentId={parent?.id}
      replyingTo={parent?names[parent.author_id]||"an archive member":undefined} disabled={busy}
      cancelReply={()=>{setReply(null);replyButton.current?.focus({preventScroll:true});}}
      saved={comment=>{saved(comment);if(parent){setReply(null);replyButton.current?.focus({preventScroll:true});}}}/>;
  }
  function renderComment(comment:FamilyComment,isReply=false) {
    return <article key={comment.id} className={`family-comment ${isReply?"comment-reply":""}`} data-comment-id={comment.id}>
      <p className="comment-byline"><strong>{names[comment.author_id]||"Archive member"}</strong>{" "}<time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString("en-AU",{timeZone:"Australia/Sydney",dateStyle:"medium",timeStyle:"short"})}</time>{comment.edited_at&&<span> · edited</span>}</p>
      {comment.archived_at?<p className="help-line">Comment archived.</p>:<p className="comment-body">{comment.body}</p>}
      {!comment.archived_at&&<div className="comment-actions">
        {!isReply&&canComment&&<button type="button" className="subtle-button" aria-label={`Reply to ${names[comment.author_id]||"this comment"}`} disabled={busy} onClick={e=>{replyButton.current=e.currentTarget;setReply(comment);}}>Reply</button>}
        {canComment&&comment.author_id===profileId&&<button type="button" className="subtle-button" disabled={busy} onClick={()=>setEditing({...comment})}>Edit your comment</button>}
        {editor&&<details><summary>Comment options</summary><button type="button" className="subtle-button" disabled={busy} onClick={()=>void change(comment,"promote")}>Keep as a recollection</button><button type="button" className="subtle-button" disabled={busy} onClick={()=>void change(comment,"archive")}>Archive comment</button></details>}
      </div>}
      {comment.archived_at&&editor&&<button type="button" className="subtle-button" disabled={busy} onClick={()=>void change(comment,"restore")}>Restore comment</button>}
      {editing?.id===comment.id&&<form onSubmit={e=>{e.preventDefault();void change(editing,"edit",String(new FormData(e.currentTarget).get("body")||""));}}>
        <label className="field">Edit your comment<textarea aria-label="Edit your comment" name="body" defaultValue={editing.body} required maxLength={10000}/></label><button className="button" disabled={busy}>Save comment</button><button className="subtle-button" type="button" disabled={busy} onClick={()=>setEditing(null)}>Cancel edit</button>
      </form>}
      {reply?.id===comment.id&&composer(comment)}
    </article>;
  }
  const visible=editor?rows:rows.filter(c=>!c.archived_at);
  return <section id={anchorId} className="family-conversation" aria-label="Family conversation">
    <h2>Family conversation</h2>
    {unavailable?<p role="alert">Conversation could not load. Reload before adding a comment.</p>:<>
      {!visible.length&&<p>A question, a familiar face, something you remember…</p>}
      {commentThreads(visible).map(([id,thread])=><div className="comment-thread" key={id}>{thread.root?renderComment(thread.root):<p className="help-line">Earlier comment unavailable.</p>}{thread.replies.map(comment=>renderComment(comment,true))}</div>)}
      {canComment&&composer()}
    </>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
function CommentComposer({archiveId,itemId,parentId,replyingTo,cancelReply,saved,disabled}:{
  archiveId:string;itemId:string;parentId?:string;replyingTo?:string;cancelReply:()=>void;saved:(comment:FamilyComment)=>void;disabled:boolean;
}) {
  const token=useRef<string|null>(null),input=useRef<HTMLTextAreaElement>(null);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{if(parentId)input.current?.focus({preventScroll:true});},[parentId]);
  return <form className="comment-composer" onSubmit={async e=>{
    e.preventDefault();const form=e.currentTarget,data=new FormData(form);token.current ||= crypto.randomUUID();
    data.set("action","post");data.set("writeId",token.current);data.set("parentId",parentId||"");setBusy(true);setMessage("");
    try {
      const result=await conversationAction(archiveId,itemId,data);
      if(result.error)setMessage(result.error);
      else if(result.comment){form.reset();token.current=null;setMessage("Comment saved.");saved(result.comment);if(!parentId)input.current?.focus({preventScroll:true});}
    } catch {setMessage("Could not save. Your comment is still here; please retry.");}finally{setBusy(false);}
  }}>
    <label className="field"><span>{replyingTo?`Reply to ${replyingTo}`:"Add a comment"}</span><textarea ref={input} name="body" required maxLength={10000} placeholder={replyingTo?"Write a reply…":"Write a comment…"} rows={2}/></label>
    <button className="button" disabled={busy||disabled}>{busy?"Saving…":replyingTo?"Post reply":"Post comment"}</button>
    {replyingTo&&<button type="button" className="subtle-button" disabled={busy} onClick={cancelReply}>Cancel reply</button>}
    {message&&<p role="status">{message}</p>}
  </form>;
}
