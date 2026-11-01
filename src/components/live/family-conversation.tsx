"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { conversationAction } from "@/lib/backend/quick-actions";
import { commentThreads, type FamilyComment } from "@/lib/conversation";
export function FamilyConversation({archiveId, itemId, comments, profileId, names, canComment, editor, unavailable = false}: {
  archiveId: string; itemId: string; comments: FamilyComment[]; profileId: string;
  names: Record<string, string>; canComment: boolean; editor: boolean; unavailable?: boolean;
}) {
  const router = useRouter();
  const [reply, setReply] = useState<FamilyComment | null>(null), [editing, setEditing] = useState<FamilyComment | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function change(comment: FamilyComment, action: string, body = "") {
    const data = new FormData();
    data.set("action", action); data.set("commentId", comment.id);
    data.set("body", body); data.set("revision", String(comment.revision));
    setBusy(true); setMessage("");
    try {
      const result = await conversationAction(archiveId, itemId, data);
      if (result.error) setMessage(result.error);
      else {
        setMessage(action === "promote" ? "Copied to recollections. The conversation stays here." : "Comment updated.");
        setEditing(null); router.refresh();
      }
    } catch {setMessage("Could not update this comment. Please retry.");}
    finally {setBusy(false);}
  }
  function renderComment(comment: FamilyComment, isReply = false) {
    return <article key={comment.id} className={`family-comment ${isReply ? "comment-reply" : ""}`} data-comment-id={comment.id}>
      <p className="comment-byline"><strong>{names[comment.author_id] || "Archive member"}</strong>{" "}
        <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString("en-AU", {timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short"})}</time>
        {comment.edited_at && <span> · edited</span>}
      </p>
      {comment.archived_at ? <p className="help-line">Comment archived.</p> : <p className="comment-body">{comment.body}</p>}
      {!comment.archived_at && <div className="comment-actions">
        {!isReply && canComment && <button className="subtle-button" disabled={busy} onClick={() => setReply(comment)}>Reply to {names[comment.author_id] || "this comment"}</button>}
        {canComment && comment.author_id === profileId && <button className="subtle-button" disabled={busy} onClick={() => setEditing({...comment})}>Edit your comment</button>}
        {editor && <details><summary>Comment options</summary>
          <button className="subtle-button" disabled={busy} onClick={() => void change(comment, "promote")}>Keep as a recollection</button>
          <button className="subtle-button" disabled={busy} onClick={() => void change(comment, "archive")}>Archive comment</button>
        </details>}
      </div>}
      {comment.archived_at && editor && <button className="subtle-button" disabled={busy} onClick={() => void change(comment, "restore")}>Restore comment</button>}
      {editing?.id === comment.id && <form onSubmit={e => {
        e.preventDefault(); void change(editing, "edit", String(new FormData(e.currentTarget).get("body") || ""));
      }}>
        <label className="field">Edit your comment<textarea aria-label="Edit your comment" name="body" defaultValue={editing.body} required maxLength={10000} /></label>
        <button className="button" disabled={busy}>Save comment</button>
        <button className="subtle-button" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel edit</button>
      </form>}
    </article>;
  }
  return <section id="family-conversation" className="family-conversation" aria-label="Family conversation">
    <h2>Family conversation</h2>
    {unavailable ? <p role="alert">Conversation could not load. Reload before adding a comment.</p> : <>
      {!comments.length && <p>A question, a familiar face, something you remember…</p>}
      {commentThreads(comments).map(([id, thread]) => <div className="comment-thread" key={id}>
        {thread.root ? renderComment(thread.root) : <p className="help-line">Earlier comment unavailable.</p>}
        {thread.replies.map(comment => renderComment(comment, true))}
      </div>)}
      {canComment && <CommentComposer key={`${itemId}:${reply?.id || "root"}`} archiveId={archiveId} itemId={itemId}
        parentId={reply?.id} replyingTo={reply ? names[reply.author_id] || "an archive member" : undefined}
        cancelReply={() => setReply(null)} saved={() => {setReply(null); router.refresh();}} />}
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
function CommentComposer({archiveId, itemId, parentId, replyingTo, cancelReply, saved}: {
  archiveId: string; itemId: string; parentId?: string; replyingTo?: string; cancelReply: () => void; saved: () => void;
}) {
  const token = useRef<string | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  return <form className="comment-composer" onSubmit={async e => {
    e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
    token.current ||= crypto.randomUUID();
    data.set("action", "post"); data.set("writeId", token.current); data.set("parentId", parentId || "");
    setBusy(true); setMessage("");
    try {
      const result = await conversationAction(archiveId, itemId, data);
      if (result.error) setMessage(result.error);
      else {form.reset(); token.current = null; setMessage("Comment saved."); saved();}
    } catch {setMessage("Could not save. Your comment is still here; please retry.");}
    finally {setBusy(false);}
  }}>
    <label className="field"><span>{replyingTo ? `Reply to ${replyingTo}` : "Add a comment"}</span>
      <textarea name="body" required maxLength={10000} placeholder="What do you recognise or remember?" rows={3} />
    </label>
    <button className="button" disabled={busy}>{busy ? "Saving…" : replyingTo ? "Post reply" : "Post comment"}</button>
    {replyingTo && <button type="button" className="subtle-button" disabled={busy} onClick={cancelReply}>Cancel reply</button>}
    {message && <p role="status">{message}</p>}
  </form>;
}
