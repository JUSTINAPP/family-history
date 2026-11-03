"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LocalSourcePreview } from "./local-source-preview";
import { useWorkspace } from "./workspace-provider";
import type { CaptureKind, SourceFile } from "@/lib/workspace-types";
type Group = { id: string; files: SourceFile[]; savedId?: string };
export function DocumentGroups({files, kind, written, quick, onStarted}: {
  files: SourceFile[]; kind: CaptureKind; written: string; quick: Record<string,string>; onStarted: () => void;
}) {
  const workspace = useWorkspace();
  const [groups, setGroups] = useState<Group[]>(() => files.map(file => ({id: file.id, files: [file]})));
  const [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [started, setStarted] = useState(false), [message, setMessage] = useState("");
  const saving = useRef(false);
  const savedCount = groups.filter(group => group.savedId).length;
  useEffect(() => {
    if (!started || savedCount === groups.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [started, savedCount, groups.length]);
  function groupSelected() {
    const pages = groups.filter(group => selected.includes(group.id)).flatMap(group => group.files);
    if (pages.length > 20 || pages.reduce((total, page) => total + page.file.size, 0) > 80 * 1024 * 1024) {
      setMessage("Keep each letter to 20 pages and 80 MB or less."); return;
    }
    const first = groups.find(group => selected.includes(group.id))!;
    setGroups(old => old.flatMap(group => group.id === first.id ? [{id: first.id, files: pages}] : selected.includes(group.id) ? [] : [group]));
    setSelected([]); setMessage("");
  }
  function move(groupId: string, index: number, delta: number) {
    setGroups(old => old.map(group => {
      if (group.id !== groupId) return group;
      const pages = [...group.files];
      [pages[index], pages[index+delta]] = [pages[index+delta], pages[index]];
      return {...group, files: pages};
    }));
  }
  async function save() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setStarted(true); onStarted(); setMessage("");
    try {
      for (const [index, group] of groups.entries()) {
        if (group.savedId) continue;
        setMessage(`Saving ${kind.toLowerCase()} ${index + 1} of ${groups.length}… Keep this page open.`);
        const id = await workspace.saveCapture({kind, title: `${kind}, still to be catalogued`, files: group.files,
          recollection: {id: crypto.randomUUID(), contributorId: workspace.profileId, recordedAt: new Date().toISOString(), originalText: written, machineTranscript: "", editedTranscript: null}, quick, suggestions: []});
        if (!id) throw new Error("Contributor access is required to save.");
        setGroups(old => old.map(entry => entry.id === group.id ? {...entry, savedId: id} : entry));
      }
      setMessage("All items saved. Each group is a separate archive item, with its pages in the order shown.");
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : "Upload interrupted."} Already saved items are kept. Retry to continue with the remaining items.`);
    } finally {saving.current = false; setBusy(false);}
  }
  return <section className="document-groups" aria-label="Arrange letters">
    <h2>Arrange your letters</h2>
    <p>Each image starts as a separate item. Select the pages of one letter, then choose “Group selected pages”. Repeat for other letters; leave single-page letters separate.</p>
    <div className="import-actions"><button type="button" className="button button-light" disabled={started || selected.length < 2} onClick={groupSelected}>Group selected pages</button><span role="status">{groups.length} separate {groups.length === 1 ? "item" : "items"} · {selected.length} selected</span></div>
    <div className="document-group-grid">{groups.map((group, groupIndex) => <article key={group.id} className={`document-group ${group.files.length > 1 ? "grouped" : ""}`}>
      <label><input type="checkbox" disabled={started} checked={selected.includes(group.id)} onChange={event => setSelected(old => event.target.checked ? [...old, group.id] : old.filter(id => id !== group.id))} /> Select item {groupIndex+1}</label>
      <div className="document-group-pages">{group.files.map((file,index) => <div key={file.id}>
        <LocalSourcePreview file={file.file} url={file.url} alt={file.originalName} />
        <p>Page {index+1} · {file.originalName}</p>
        <details><summary>Page role</summary><label><span className="sr-only">Page role</span><select aria-label={`Page role for ${file.originalName}`} disabled={started} value={file.role} onChange={event => setGroups(old => old.map(entry => entry.id === group.id ? {...entry, files: entry.files.map(page => page.id === file.id ? {...page, role: event.target.value} : page)} : entry))}><option value="page">Page</option><option value="page-front">Page front</option><option value="page-back">Page back</option><option value="envelope-front">Envelope front</option><option value="envelope-back">Envelope back</option><option value="image">Image</option></select></label></details>
        {group.files.length > 1 && <div className="page-order-actions"><button disabled={started || index === 0} aria-label={`Move page ${index+1} earlier in item ${groupIndex+1}`} onClick={() => move(group.id,index,-1)}>←</button><button disabled={started || index === group.files.length-1} aria-label={`Move page ${index+1} later in item ${groupIndex+1}`} onClick={() => move(group.id,index,1)}>→</button></div>}
      </div>)}</div>
      <p>{group.files.length} {group.files.length === 1 ? "page" : "pages"} · one {kind.toLowerCase()}</p>
      {group.files.length > 1 && !started && <button type="button" className="subtle-button" onClick={() => {setGroups(old => old.flatMap(entry => entry.id === group.id ? entry.files.map(file => ({id:file.id,files:[file]})) : [entry]));setSelected([]);}}>Ungroup pages</button>}
      {group.savedId && <Link className="text-link" href={`/archive/${group.savedId}`}>Saved — view item ↗</Link>}
    </article>)}</div>
    {savedCount < groups.length && <button type="button" className="button" disabled={busy} onClick={save}>{busy ? "Saving…" : started ? "Retry remaining items" : `Save ${groups.length} ${groups.length === 1 ? "item" : "items"}`}</button>}
    <p className="help-line">{savedCount} of {groups.length} saved. Original files are preserved unchanged. Any optional note or details apply to every item in this selection.</p>
    {message && <p role="status" className="notice">{message}</p>}
  </section>;
}
