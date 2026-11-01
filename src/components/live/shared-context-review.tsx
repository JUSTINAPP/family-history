"use client";
import Link from "next/link";
import { useState } from "react";
import { copySharedContext } from "@/lib/backend/shared-context-actions";
interface Note { id: string; text: string; kind: "recollection" | "person"; }
export function SharedContextReview({source, photographs, notes}: {
  source: string; photographs: { id: string; title: string }[]; notes: Note[];
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  if (!notes.length) return null;
  return <section className="notice" id="earlier-notes">
    <h2>Review earlier notes</h2>
    <p>These notes were added before the photographs were separated. Choose the photograph each note belongs with. The earlier notes will be kept.</p>
    {notes.map(note => <form className="shared-note" key={note.id} action={async form => {
      setBusy(true); setMessage("");
      try {
        form.set("source", source); form.set("id", note.id); form.set("kind", note.kind);
        const result = await copySharedContext(form);
        setMessage(result.error || (note.kind === "person" ? "Person linked to the selected photograph for review." : "Recollection copied to the selected photograph."));
      } catch { setMessage("Could not copy this note. Please retry."); }
      finally { setBusy(false); }
    }}>
      {note.kind === "recollection" ? <blockquote>{note.text}</blockquote> : <p>Person: {note.text}</p>}
      <label>Photograph for {note.kind === "person" ? note.text : "this recollection"}
        <select name="target" required defaultValue=""><option value="" disabled>Choose a photograph</option>
          {photographs.map((child, i) => <option key={child.id} value={child.id}>Photograph {i+1} · {child.title}</option>)}
        </select>
      </label>
      <button className="subtle-button" disabled={busy}>{note.kind === "person" ? "Link Person" : "Copy recollection"}</button>
    </form>)}
    <p>{photographs.map((child, i) => <span key={child.id}><Link className="text-link" href={`/archive/${child.id}`}>View photograph {i+1} ↗</Link>{" "}</span>)}</p>
    {message && <p role="status">{message}</p>}
  </section>;
}
