"use client";
import { startTransition, useEffect, useId, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Mic, PencilLine } from "lucide-react";
import type { ArchiveItem } from "@/lib/types";
import { can } from "@/lib/permissions";
import { loadCardDetails } from "@/lib/backend/card-details-action";
import { useWorkspace } from "../workspace-provider";
import { MemoryViewer } from "../audio/memory-viewer";
import { IdentificationForm } from "./identification-form";
import { PlacePicker } from "./place-picker";
import { QuickField } from "./quick-field";

type Details = NonNullable<Awaited<ReturnType<typeof loadCardDetails>>["data"]>;
export function CardDetails({item}: {item: ArchiveItem}) {
  const workspace = useWorkspace(), id = useId();
  const [open, setOpen] = useState(false), [record, setRecord] = useState(false);
  const [data, setData] = useState<Details | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open && !record) return;
    let active = true;
    startTransition(() => {setBusy(true); setError("");});
    void loadCardDetails(workspace.archive.id, item.id).then(result => {
      if (!active) return;
      if (result.data) setData(result.data);
      else setError(result.error || "Details could not load.");
    }).catch(() => {if(active)setError("Details could not load. Please retry.");})
      .finally(() => {if(active)setBusy(false);});
    return () => {active = false;};
  }, [open, record, item, workspace.archive.id, retry]);
  if (workspace.mode !== "live" || item.archivedAt || item.ingestionStatus !== "ready" || !can(workspace.role, "commenter")) return null;
  return <div className="card-quick-actions">
    <div className="card-quick-buttons">
      {can(workspace.role,"contributor") && <button className="memory-button" aria-haspopup="dialog" onClick={() => setRecord(true)}><Mic size={18} aria-hidden="true"/>Record a memory</button>}
      <button className="memory-button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><PencilLine size={18} aria-hidden="true"/>{open ? "Hide quick details" : "Who, where, when"}</button>
    </div>
    {busy && <p role="status"><LoaderCircle className="memory-spinner" size={18} aria-hidden="true"/> Loading details…</p>}
    {error && <p role="alert">{error} <button className="subtle-button" onClick={() => setRetry(n=>n+1)}>Retry</button></p>}
    <section hidden={!open} id={id} className="card-quick-editor" aria-label={`Quick details: ${item.title}`}>
      {data && <>
        <p className="help-line">Save each detail here. You can add more later.</p>
        <IdentificationForm archiveId={workspace.archive.id} itemId={item.id} people={data.people} identifications={data.identifications} role={data.role} profileId={data.profileId} canCreate={data.editable} unavailable={!!error || busy} simple />
        <PlacePicker archiveId={workspace.archive.id} itemId={item.id} places={data.places} links={data.links} reportedText={data.item.place === "Place not yet known" ? "" : data.item.place} editable={data.editable && !busy && !error} editor={can(data.role,"editor")} profileId={data.profileId} simple />
        <QuickField archiveId={workspace.archive.id} itemId={item.id} field="date" value={data.item.date === "Date not yet known" ? "" : data.item.date} precision={data.item.datePrecision} editable={data.editable && !busy && !error} />
        {!data.editable && <p className="help-line">You can suggest a person. Date and place changes require permission to edit this item.</p>}
        <Link prefetch={false} className="text-link" href={item.href!}>Open full record ↗</Link>
      </>}
    </section>
    {record && !data && <button className="subtle-button" onClick={() => setRecord(false)}>Cancel opening recorder</button>}
    {record && data && <MemoryViewer item={item} recordings={data.recordings} initialMode="record" onClose={() => setRecord(false)} />}
  </div>;
}
