"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { prepareDisplay } from "@/lib/preview/client";
import type { ImageSet } from "@/lib/preview/types";
import { Mic, Headphones } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { can } from "@/lib/permissions";
import { ArchiveImage } from "../archive-image";
import { MemoryViewer } from "./memory-viewer";
import type { RecordingView } from "@/lib/audio/repository";
import type { ArchiveItem } from "@/lib/types";
export function PhotoMemories({ item, recordings, priority, eager = false, children }: { item: ArchiveItem; recordings: RecordingView[]; priority: boolean; eager?: boolean; children: ReactNode }) {
  const workspace = useWorkspace();
  const root = useRef<HTMLDivElement>(null);
  const [prepared, setPrepared] = useState<ImageSet>();
  const [previewError, setPreviewError] = useState(false);
  const [retry, setRetry] = useState(0);
  const displayItem = prepared ? {...item, imageSet: prepared} : item;
  useEffect(() => {
    if (item.imageSet || prepared || !item.image.startsWith("/api/v1/previews/") || !root.current) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void prepareDisplay(item.image, retry > 0).then(set => {
        if (active && set) setPrepared(set);
      }).catch(() => {if (active) setPreviewError(true);});
    }, {root: root.current.closest(".home-slider"), rootMargin: "200px"});
    observer.observe(root.current);
    return () => {active = false; observer.disconnect();};
  }, [item.image, item.imageSet, prepared, retry]);
  const [mode, setMode] = useState<"listen" | "record" | null>(null);
  return <div className="photo-memories" ref={root}>
    <button type="button" className="photo-open" aria-label={`View photo: ${item.title}`} aria-haspopup="dialog" onClick={() => setMode("listen")}>
      <ArchiveImage key={displayItem.imageSet?.id || item.image} src={item.image} alt={item.title} imageSet={displayItem.imageSet} rotation={item.rotation} variant="small" autoPrepare={false} priority={priority} eager={eager} fetchPriority={priority ? "high" : "low"} fitFrame sizes="(max-width: 820px) 80vw, 400px" />
    </button>
    {previewError && !displayItem.imageSet && <button className="text-link" onClick={() => {setPreviewError(false); setRetry(n => n + 1);}}>Retry image preview</button>}
    {children}
    <div className="memory-actions">
      {can(workspace.role, "contributor") && <button type="button" className="memory-button" aria-haspopup="dialog" onClick={() => setMode("record")}><Mic size={18} aria-hidden="true" />Record a message</button>}
      {!!recordings.length && <button type="button" className="memory-button listen-badge" aria-label={`Listen to ${recordings.length} ${recordings.length === 1 ? "memory" : "memories"} about ${item.title}`} aria-haspopup="dialog" onClick={() => setMode("listen")}><Headphones size={18} aria-hidden="true" />Listen{recordings.length > 1 ? ` (${recordings.length})` : ""}</button>}
    </div>
    {mode && <MemoryViewer item={displayItem} recordings={recordings} initialMode={mode} onClose={() => setMode(null)} />}
  </div>;
}
