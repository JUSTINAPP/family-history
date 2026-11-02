"use client";
import { useState, type ReactNode } from "react";
import { Mic, Headphones } from "lucide-react";
import { useWorkspace } from "../workspace-provider";
import { can } from "@/lib/permissions";
import { ArchiveImage } from "../archive-image";
import { MemoryViewer } from "./memory-viewer";
import type { RecordingView } from "@/lib/audio/repository";
import type { ArchiveItem } from "@/lib/types";
export function PhotoMemories({ item, recordings, priority, children }: { item: ArchiveItem; recordings: RecordingView[]; priority: boolean; children: ReactNode }) {
  const workspace = useWorkspace();
  const [mode, setMode] = useState<"listen" | "record" | null>(null);
  return <div className="photo-memories">
    <button type="button" className="photo-open" aria-label={`View photo: ${item.title}`} aria-haspopup="dialog" onClick={() => setMode("listen")}>
      <ArchiveImage src={item.image} alt={item.title} imageSet={item.imageSet} rotation={item.rotation} variant="small" autoPrepare={false} priority={priority} fitFrame sizes="(max-width: 820px) 80vw, 400px" />
    </button>
    {children}
    <div className="memory-actions">
      {can(workspace.role, "contributor") && <button type="button" className="memory-button" aria-haspopup="dialog" onClick={() => setMode("record")}><Mic size={18} aria-hidden="true" />Record a message</button>}
      {!!recordings.length && <button type="button" className="memory-button listen-badge" aria-label={`Listen to ${recordings.length} ${recordings.length === 1 ? "memory" : "memories"} about ${item.title}`} aria-haspopup="dialog" onClick={() => setMode("listen")}><Headphones size={18} aria-hidden="true" />Listen{recordings.length > 1 ? ` (${recordings.length})` : ""}</button>}
    </div>
    {mode && <MemoryViewer item={item} recordings={recordings} initialMode={mode} onClose={() => setMode(null)} />}
  </div>;
}
