"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "../workspace-provider";
import { useImportSelection } from "../import-selection";
import { PageIntro } from "../ui";
import { LocalSourcePreview } from "../local-source-preview";
import { browserSupabase } from "@/lib/supabase/client";
import { validateFiles } from "@/lib/capture";
import { importPhotographs, type ImportEntry } from "@/lib/bulk-import";
import { readImportBatch, type BatchSnapshot } from "@/lib/import-batches";
import { resumeEntries, sourceEntries } from "@/lib/bulk-resume";
import { prepareDisplay } from "@/lib/preview/client";
import { can } from "@/lib/permissions";
function ImportPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(file);
    let active = true;
    queueMicrotask(() => {
      if (active) setUrl(value);
    });
    return () => {
      active = false;
      URL.revokeObjectURL(value);
    };
  }, [file]);
  return url ? (
    <LocalSourcePreview file={file} url={url} alt={file.name} />
  ) : (
    <p>Preparing preview…</p>
  );
}
export function BulkImport() {
  const workspace = useWorkspace(),
    { archive, role } = workspace,
    selection = useImportSelection(),
    router = useRouter(),
    params = useSearchParams();
  const [initialId] = useState(() => params.get("batch"));
  const [batchId] = useState(() => initialId || crypto.randomUUID());
  const [entries, setEntries] = useState<ImportEntry[]>(() =>
    selection.selection?.archiveId === archive.id
      ? selection.selection.files.map((file) => ({
          file,
          captureId: crypto.randomUUID(),
          status: "pending",
        }))
      : [],
  );
  const [snapshot, setSnapshot] = useState<BatchSnapshot | null>(null),
    [context, setContext] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [created, setCreated] = useState(!!initialId),
    [expected, setExpected] = useState(0);
  const imported = entries.filter((e) => e.status === "saved"),
    failed = entries.filter((e) => e.status === "failed").length;
  const started = created || entries.some((e) => e.status !== "pending");
  const total = Math.max(expected, entries.length);
  useEffect(() => {
    if (!initialId || workspace.mode === "demo") return;
    let active = true;
    void readImportBatch(browserSupabase(), initialId)
      .then((batch) => {
        if (!active) return;
        if (!batch || batch.archiveId !== archive.id)
          throw new Error(
            "This import is not available in the current archive.",
          );
        setSnapshot(batch);
        setContext(batch.context);
        setExpected(batch.expectedCount);
        setEntries(sourceEntries(batch.sources));
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
    };
  }, [initialId, archive.id, workspace.mode]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
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
  async function choose(files: File[]) {
    const result = validateFiles(files);
    setError(result.error);
    if (result.accepted.length > 500) {
      setError("Choose up to 500 photographs per batch.");
      return;
    }
    setBusy(true);
    try {
      const next = snapshot
        ? await resumeEntries(result.accepted, snapshot.sources)
        : result.accepted.map((file) => ({
            file,
            captureId: crypto.randomUUID(),
            status: "pending" as const,
          }));
      if (created && next.length > total) {
        setError(
          "This selection contains extra files. Choose the original batch files; import different photographs in a new batch.",
        );
        return;
      }
      setEntries(next);
      if (!created) setExpected(next.length);
    } catch {
      setError("The selected files could not be checked. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const client = workspace.mode === "live" ? browserSupabase() : null;
      if (client) {
        const { error } = await client.rpc("create_import_batch", {
          p_archive_id: archive.id,
          p_batch_id: batchId,
          p_context: context,
          p_expected_count: total,
        });
        if (error)
          throw new Error(
            "The import could not be prepared. Check Contributor access and migration 007.",
          );
      }
      setCreated(true);
      window.history.replaceState(
        null,
        "",
        `/add/bulk?workflow=import&batch=${batchId}`,
      );
      const completed: ImportEntry[] = [];
      await importPhotographs(
        client!,
        entries,
        archive.id,
        context,
        (entry) => {
          setEntries((old) =>
            old.map((e) => (e.captureId === entry.captureId ? entry : e)),
          );
          if (entry.status === "saved") completed.push(entry);
        },
        workspace.mode === "demo"
          ? async (_client, form) => {
              const file = form.get("files") as File;
              const url = URL.createObjectURL(file);
              workspace.registerUrl(url);
              const id = await workspace.saveCapture({
                kind: "Photograph",
                title: String(form.get("title")),
                importBatchId: batchId,
                files: [
                  {
                    id: crypto.randomUUID(),
                    file,
                    url,
                    originalName: file.name,
                    role: "image",
                  },
                ],
                recollection: {
                  id: crypto.randomUUID(),
                  contributorId: workspace.profileId,
                  recordedAt: new Date().toISOString(),
                  originalText: "",
                  machineTranscript: "",
                  editedTranscript: null,
                },
                quick: { precision: "unknown" },
                suggestions: [],
              });
              return { id };
            }
          : undefined,
        batchId,
      );
      selection.clear();
      if (client) {
        const updated = await readImportBatch(client, batchId);
        if (updated) setSnapshot(updated);
        completed.forEach((entry) => {
          void client
            .from("archive_item_files")
            .select("id")
            .eq("item_id", entry.itemId!)
            .eq("purpose", "original")
            .then(({ data }) =>
              data?.forEach((file) => {
                void prepareDisplay(`/api/v1/previews/${file.id}`).catch(
                  () => {},
                );
              }),
            );
        });
      }
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Import interrupted. Preserved originals remain safe; resume this batch after reconnecting.",
      );
    } finally {
      setBusy(false);
    }
  }
  const complete = total > 0 && imported.length === total;
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="BULK IMPORT PHOTOGRAPHS"
        title="One photograph. One place in the archive."
        description="Choose separate photographs here. Import first; add each photograph’s names, dates and story later."
      />
      <nav className="import-actions" aria-label="Add to archive options">
        <Link className="text-link" href="/add">
          Add one item ↗
        </Link>
        <span aria-current="page">Bulk import photographs</span>
        <Link className="text-link" href="/add/voice">
          Voice recording ↗
        </Link>
      </nav>
      {workspace.mode === "live" && (
        <p>
          <Link className="text-link" href="/imports">
            Recent imports and unfinished batches ↗
          </Link>
        </p>
      )}
      {workspace.mode === "demo" && (
        <p className="notice">
          Demo import only. Nothing is uploaded to Supabase.
        </p>
      )}
      <div className="catalogue-form">
        <label className="field">
          <span>
            {created
              ? "Choose original batch files again to resume"
              : "Choose photographs"}
          </span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
            disabled={busy || complete || (created && !initialId && !snapshot)}
            onChange={(event) => {
              void choose(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />
        </label>
        <p className="help-line">
          Each selected photograph becomes a separate item. Up to 500
          photographs, 30 MB each. For front/back or several views of one thing,
          use Add one item.
        </p>
        <label className="field">
          <span>Batch context (optional)</span>
          <textarea
            value={context}
            disabled={busy || started}
            maxLength={20000}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Janice’s photo box, scanned November 2026…"
          />
        </label>
        <p className="help-line">
          Kept once with this import batch. These words do not become each
          photograph’s caption or recollection.
        </p>
        {created && workspace.mode === "live" && (
          <p>
            <Link className="text-link" href={`/imports/${batchId}`}>
              View preserved import progress ↗
            </Link>
          </p>
        )}
        {total > 0 && (
          <>
            <p role="status" aria-live="polite">
              {imported.length} of {total} photographs added
              {failed ? ` · ${failed} need retry` : ""}
              {busy ? " · importing…" : ""}
            </p>
            <progress
              aria-label="Import progress"
              value={imported.length}
              max={total}
            />
            <div className="import-previews">
              {entries
                .filter((e) => e.file.size > 0)
                .slice(0, 6)
                .map((e) => (
                  <div key={e.captureId}>
                    <ImportPreview file={e.file} />
                  </div>
                ))}
            </div>
            {!complete && (
              <button
                className="button"
                disabled={
                  busy ||
                  !entries.some((e) => e.status !== "saved" && !e.needsFile)
                }
                onClick={run}
              >
                {busy
                  ? "Importing photographs…"
                  : failed
                    ? "Retry unfinished imports"
                    : "Import all"}
              </button>
            )}
            {complete && (
              <section className="notice" aria-label="Import complete">
                <h2>
                  {imported.length} photographs safely added to {archive.name}
                </h2>
                <p>
                  Originals are preserved. Each photograph has its own item;
                  previews can finish separately.
                </p>
                <div className="import-actions">
                  <Link
                    className="text-link"
                    href={`/explore?archive=${archive.id}&batch=${batchId}`}
                  >
                    View imported photographs ↗
                  </Link>
                  {workspace.mode === "live" && (
                    <Link className="text-link" href={`/imports/${batchId}`}>
                      Review import inbox ↗
                    </Link>
                  )}
                  <Link
                    className="text-link"
                    href={
                      workspace.mode === "demo"
                        ? `/add/saved/${imported[0]?.itemId}`
                        : `/archive/${imported[0]?.itemId}/edit?batch=${batchId}`
                    }
                  >
                    Catalogue first photograph ↗
                  </Link>
                  <a className="text-link" href="/add/bulk?workflow=import">
                    Add more ↗
                  </a>
                </div>
              </section>
            )}
            {imported.length > 0 && !complete && (
              <p>
                <Link
                  className="text-link"
                  href={`/explore?archive=${archive.id}&batch=${batchId}`}
                >
                  View successfully imported photographs ↗
                </Link>
              </p>
            )}
            {created && entries.length < total && (
              <p className="notice">
                {total - entries.length} photographs have not reached a
                reservation yet. Reselect the original batch to finish. Already
                imported photographs are matched and skipped.
              </p>
            )}
            <ul className="import-list">
              {entries.map((e) => (
                <li key={e.captureId}>
                  <span>{e.file.name}</span>
                  <span>
                    {e.status === "saved" ? (
                      <Link
                        href={
                          workspace.mode === "demo"
                            ? `/add/saved/${e.itemId}`
                            : `/archive/${e.itemId}`
                        }
                      >
                        Imported ↗
                      </Link>
                    ) : e.status === "uploading" ? (
                      "Uploading original…"
                    ) : e.status === "failed" ? (
                      "Needs retry"
                    ) : (
                      "Ready"
                    )}
                  </span>
                  {e.error && (
                    <p className="help-line" role="alert">
                      {e.error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
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
