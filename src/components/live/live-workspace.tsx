"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  WorkspaceContext,
  type NewCapture,
  type Workspace,
} from "../workspace-provider";
import { prepareDisplay } from "@/lib/preview/client";
import { browserSupabase } from "@/lib/supabase/client";
import { persistUpload } from "@/lib/backend/upload-core";
import type { LiveSnapshot } from "@/lib/backend/repository";
import {
  saveArchiveAction,
  selectArchiveAction,
  manageMemberAction,
} from "@/lib/backend/actions";
export function LiveWorkspaceProvider({
  snapshot,
  children,
}: {
  snapshot: LiveSnapshot;
  children: React.ReactNode;
}) {
  const [fresh, setFresh] = useState<{
    base: LiveSnapshot;
    value: LiveSnapshot;
  } | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  const router = useRouter();
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  // A new server snapshot always replaces an older optimistic refresh, even when its count is smaller.
  const current = fresh?.base === snapshot ? fresh.value : snapshot;
  const role =
    current.members.find(
      (m) => m.profileId === current.profileId && m.status === "active",
    )?.role || "viewer";
  async function refresh() {
    const response = await fetch(
      `/api/v1/workspace?archive=${current.archive.id}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(
        "Your item was saved, but the archive could not refresh. Reload to view it.",
      );
    const updated = await response.json();
    if (updated) setFresh({ base: snapshot, value: updated });
    router.refresh();
  }
  async function saveCapture(input: NewCapture) {
    const signature = JSON.stringify([
      current.archive.id,
      input.kind,
      input.recollection.originalText,
      input.quick,
      input.files.map((f) => [
        f.originalName,
        f.file.size,
        f.file.lastModified,
        f.role,
      ]),
    ]);
    if (!attempt.current || attempt.current.signature !== signature)
      attempt.current = { signature, id: crypto.randomUUID() };
    const form = new FormData();
    form.set("archiveId", current.archive.id);
    form.set("captureId", attempt.current.id);
    form.set("title", input.title);
    form.set("kind", input.kind);
    form.set("context", input.recollection.originalText);
    form.set("quick", JSON.stringify(input.quick));
    form.set("roles", JSON.stringify(input.files.map((f) => f.role)));
    input.files.forEach((f) => form.append("files", f.file, f.originalName));
    let result: { id: string; sourceIds?: string[] };
    try {
      result = await persistUpload(browserSupabase(), form);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? error.message
          : "Upload interrupted. Keep this page open and retry with the same originals.",
      );
    }
    result.sourceIds?.forEach((id) => {
      void prepareDisplay(`/api/v1/previews/${id}`).catch(() => {});
    });
    attempt.current = null;
    try {
      await refresh();
    } catch {
      router.refresh();
    }
    return result.id as string;
  }
  const value: Workspace = {
    mode: "live",
    profileId: current.profileId,
    profileName: current.profileName,
    profileEmail: current.profileEmail,
    archive: current.archive,
    archives: current.archives,
    catalogue: current.catalogue,
    catalogueAvailable: current.catalogueAvailable,
    catalogueCount: current.catalogueCount,
    resourceWarnings: current.resourceWarnings,
    historicalPeople: current.people,
    capturedCount: current.catalogue.length,
    role,
    setRole: () => {},
    selectArchive: async (id) => {
      const error = await selectArchiveAction(id);
      if (error) return false;
      router.refresh();
      return true;
    },
    saveArchive: async (archive) => {
      const error = await saveArchiveAction(archive);
      if (!error) router.refresh();
      return error;
    },
    captures: [],
    saveCapture,
    registerUrl: (url) => urls.current.push(url),
    members: current.members,
    updateMember: async (id, patch) => {
      const error = await manageMemberAction(current.archive.id, id, patch);
      if (!error) router.refresh();
      return error;
    },
    invitations: [],
    invite: () =>
      "Email invitations are not operational yet. Configure a secure delivery/redemption flow first.",
    updateInvitation: () => {},
    settings: current.archive.settings,
    activity: current.activity,
    log: () => {},
    jobs: current.jobs,
    retryJob: () => {},
    finishReview: () => {},
    reviewedText: {},
    saveReview: () => {},
  };
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
