"use client";
import { prepareDisplay } from "@/lib/preview/client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../workspace-provider";
import { PageIntro } from "../ui";
import { LocalSourcePreview } from "../local-source-preview";
import { browserSupabase } from "@/lib/supabase/client";
import { validateFiles } from "@/lib/capture";
import { importPhotographs, type ImportEntry } from "@/lib/bulk-import";
import { can } from "@/lib/permissions";
export function BulkImport() {
  const { archive, role } = useWorkspace();
  const [entries, setEntries] = useState<ImportEntry[]>([]);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const urls = useRef(new Map<File, string>());
  const router = useRouter();
  useEffect(() => {
    const current = urls.current;
    return () => current.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    if (busy) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  if (!can(role, "contributor"))
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow="BULK IMPORT"
          title="Contributor access required."
          description="An archive administrator can help you contribute photographs."
        />
      </div>
    );
  const saved = entries.filter((e) => e.status === "saved").length;
  const failed = entries.filter((e) => e.status === "failed").length;
  const started = entries.some((e) => e.status !== "pending");
  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await importPhotographs(
        browserSupabase(),
        entries,
        archive.id,
        context,
        (entry) => {
          setEntries((old) =>
            old.map((e) => (e.captureId === entry.captureId ? entry : e)),
          );
          if (entry.status === "saved")
            void browserSupabase()
              .from("archive_item_files")
              .select("id")
              .eq("archive_id", archive.id)
              .eq("item_id", entry.itemId!)
              .eq("purpose", "original")
              .then(({ data }) => {
                data?.forEach((file) => {
                  void prepareDisplay(`/api/v1/previews/${file.id}`).catch(
                    () => {},
                  );
                });
              });
        },
      );
      router.refresh();
    } catch {
      setError(
        "Import interrupted. Keep this page open and retry; saved originals remain preserved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="BULK IMPORT"
        title="Bring the photographs in."
        description="Import first. Add names, dates and stories whenever you are ready. Each photograph becomes its own archive item."
      />
      <div className="catalogue-form">
        <label className="field">
          <span>Choose photographs</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            multiple
            disabled={busy || started}
            onChange={(event) => {
              const result = validateFiles(
                Array.from(event.target.files || []),
              );
              setError(result.error);
              const unique = result.accepted.filter(
                (file, index, list) =>
                  list.findIndex(
                    (f) =>
                      f.name === file.name &&
                      f.size === file.size &&
                      f.lastModified === file.lastModified,
                  ) === index,
              );
              if (unique.length > 500) {
                setError("Choose up to 500 photographs per batch.");
                return;
              }
              urls.current.forEach((url) => URL.revokeObjectURL(url));
              urls.current.clear();
              unique
                .slice(0, 6)
                .forEach((file) =>
                  urls.current.set(file, URL.createObjectURL(file)),
                );
              setEntries(
                unique.map((file) => ({
                  file,
                  previewUrl: urls.current.get(file),
                  captureId: crypto.randomUUID(),
                  status: "pending",
                })),
              );
            }}
          />
        </label>
        <p className="help-line">
          JPEG, PNG, WebP or HEIC/HEIF · up to 30 MB each. Keep this page open
          until import finishes. Display previews prepare separately; originals
          are saved first.
        </p>
        <label className="field">
          <span>Batch context (optional)</span>
          <textarea
            maxLength={20000}
            value={context}
            disabled={started || busy}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Janice’s photo box, India photographs…"
          />
        </label>
        <p className="help-line">
          Your words are kept as a separate recollection on each item.
        </p>
        {!!entries.length && (
          <>
            <p role="status" aria-live="polite">
              {saved} of {entries.length} imported
              {failed ? ` · ${failed} need retry` : ""}
              {busy ? " · uploading originals…" : ""}
            </p>
            <progress
              aria-label="Import progress"
              value={saved + failed}
              max={entries.length}
            />
            <div className="import-previews">
              {entries.slice(0, 6).map((entry) => (
                <div key={entry.captureId}>
                  <LocalSourcePreview
                    file={entry.file}
                    url={entry.previewUrl!}
                    alt={entry.file.name}
                  />
                </div>
              ))}
            </div>
            <div className="import-actions">
              <button
                className="button"
                disabled={busy || saved === entries.length}
                onClick={run}
              >
                {busy
                  ? "Importing originals…"
                  : failed
                    ? "Retry unfinished imports"
                    : "Import photographs"}
              </button>
              {saved > 0 && (
                <Link className="text-link" href="/explore">
                  Browse imported photographs ↗
                </Link>
              )}
            </div>
            <ul className="import-list">
              {entries.map((entry) => (
                <li key={entry.captureId}>
                  <span>{entry.file.name}</span>
                  <span>
                    {entry.status === "saved" ? (
                      <Link href={`/archive/${entry.itemId}`}>Imported ↗</Link>
                    ) : entry.status === "uploading" ? (
                      "Uploading original…"
                    ) : entry.status === "failed" ? (
                      "Needs retry"
                    ) : (
                      "Ready"
                    )}
                  </span>
                  {entry.error && (
                    <p role="alert" className="help-line">
                      {entry.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {!busy && saved === entries.length && (
              <button
                className="subtle-button"
                onClick={() => {
                  setEntries([]);
                  setContext("");
                }}
              >
                Start another batch
              </button>
            )}
          </>
        )}
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
