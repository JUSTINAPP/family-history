"use client";
import { useEffect, useRef, useState } from "react";
import {
  Upload,
  FolderOpen,
  ImagePlus,
  ArrowRight,
  Download,
  Check,
} from "lucide-react";
import { ArchiveImage, PageIntro, TextLink, Eyebrow } from "./ui";
import { validateFiles, createDraft, downloadDraft } from "@/lib/capture";
import { useWorkspace } from "./workspace-provider";
import { can } from "@/lib/permissions";
import { demoProfileId } from "@/lib/demo-workspace";
import type { CaptureDraft } from "@/lib/types";
import { people } from "@/lib/data";
interface BulkFile {
  id: string;
  file: File;
  url: string;
}
export function BulkUpload() {
  const workspace = useWorkspace();
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [ready, setReady] = useState(0);
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<CaptureDraft[]>([]);
  const [complete, setComplete] = useState(false);
  const [precision, setPrecision] = useState("approximate");
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const urls = useRef<string[]>([]);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    folderInput.current?.setAttribute("webkitdirectory", "");
  }, []);
  useEffect(() => {
    if (ready >= files.length) return;
    const t = setTimeout(
      () =>
        setReady((n) =>
          Math.min(files.length, n + Math.max(1, Math.ceil(files.length / 15))),
        ),
      90,
    );
    return () => clearTimeout(t);
  }, [files.length, ready]);
  function add(incoming: File[]) {
    if (!incoming.length) return;
    const { accepted, error: validationError } = validateFiles(incoming);
    const selected = accepted.slice(0, 500);
    setError(
      [
        validationError,
        accepted.length > 500
          ? "This demo handles up to 500 images per batch."
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    if (!selected.length) return;
    urls.current = [];
    setFiles(
      selected.map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.push(url);
        workspace.registerUrl(url);
        return { id: crypto.randomUUID(), file, url };
      }),
    );
    setReady(0);
    setIndex(0);
    setRecords([]);
    setComplete(false);
    setPrecision("approximate");
    form.current?.reset();
  }
  function save(data: FormData) {
    const draft = createDraft(
      data,
      "Photograph",
      [files[index].file],
      workspace.archive.id,
    );
    const current = files[index];
    workspace.saveCapture({
      kind: "Photograph",
      title: current.file.name,
      files: [
        {
          id: current.id,
          file: current.file,
          url: current.url,
          role: "image",
          originalName: current.file.name,
        },
      ],
      recollection: {
        id: crypto.randomUUID(),
        contributorId: demoProfileId,
        recordedAt: draft.createdAt,
        originalText: draft.notes,
        machineTranscript: "",
        editedTranscript: null,
      },
      quick: {
        People: draft.who,
        When: draft.when,
        Where: draft.where,
        precision: draft.datePrecision,
      },
      suggestions: [],
    });
    setRecords((old) => [...old, draft]);
    if (index === files.length - 1) setComplete(true);
    else {
      setIndex((i) => i + 1);
      setPrecision("approximate");
      form.current?.reset();
    }
  }
  const current = files[index];
  if (!can(workspace.role, "contributor"))
    return (
      <div className="page-shell">
        <PageIntro
          eyebrow="ARCHIVE ACCESS"
          title="A place to contribute."
          description="Contributor, Editor or Admin access is required to add a batch."
        />
        <TextLink href="/admin">Change demo access preview</TextLink>
      </div>
    );
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="A WHOLE BOX OF MEMORIES"
        title="One by one. All together."
        description="Bring in a folder of photographs, then add a little of what you know. There’s no need to catalogue everything at once."
      >
        <TextLink href="/add">Just adding a few?</TextLink>
      </PageIntro>
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*,.heic,.heif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Select images"
        onChange={(e) => add(Array.from(e.target.files || []))}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Select image folder"
        onChange={(e) => add(Array.from(e.target.files || []))}
      />
      {!files.length ? (
        <section
          className={`bulk-drop ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(Array.from(e.dataTransfer.files));
          }}
        >
          <Upload size={35} strokeWidth={1} style={{ margin: "0 auto" }} />
          <h2>Drag files here.</h2>
          <p>
            A handful, or a hundred. JPEG, PNG, WebP and HEIC.
            <br />
            Up to 30 MB per file · 500 images per demo batch
          </p>
          <div className="capture-buttons">
            <button
              className="button"
              onClick={() => fileInput.current?.click()}
            >
              <ImagePlus size={16} />
              Choose images
            </button>
            <button
              className="button button-light"
              onClick={() => folderInput.current?.click()}
            >
              <FolderOpen size={16} />
              Select folder
            </button>
          </div>
          <p className="help-line">
            On a phone? Use{" "}
            <a href="/add" style={{ textDecoration: "underline" }}>
              the capture flow
            </a>{" "}
            to take photos directly.
          </p>
        </section>
      ) : (
        <>
          <div className="bulk-stats">
            <span>
              {complete
                ? "Batch reviewed"
                : ready < files.length
                  ? "Preparing local previews…"
                  : `Reviewing ${index + 1} of ${files.length}`}
            </span>
            <span>
              {records.length} catalogued · {files.length} selected
            </span>
          </div>
          <div
            className="progress-line"
            role="progressbar"
            aria-label={
              ready < files.length
                ? "Preparing previews"
                : "Batch review progress"
            }
            aria-valuemin={0}
            aria-valuemax={files.length}
            aria-valuenow={ready < files.length ? ready : records.length}
          >
            <span
              style={{
                width: `${((ready < files.length ? ready : records.length) / files.length) * 100}%`,
              }}
            />
          </div>
          <p className="help-line" style={{ marginBottom: 30 }}>
            Local demo · no files uploaded. Originals are read for previews and
            are never changed.
          </p>
          {complete ? (
            <section className="status-panel">
              <Check size={30} />
              <h2>A little more of the story, recorded.</h2>
              <p>
                You have catalogued {records.length} images in this session.
                Export the details before leaving. The JSON does not include the
                original image files.
              </p>
              <div className="small-actions">
                <button
                  onClick={() =>
                    downloadDraft({ status: "local_demo_batch", records })
                  }
                >
                  <Download
                    size={13}
                    style={{ display: "inline", marginRight: 8 }}
                  />
                  Export batch details
                </button>
                <button
                  onClick={() => {
                    setFiles([]);
                    setComplete(false);
                    setRecords([]);
                    setIndex(0);
                  }}
                >
                  Start another batch
                </button>
              </div>
            </section>
          ) : ready === files.length && current ? (
            <div className="bulk-review">
              <div>
                <ArchiveImage
                  src={current.url}
                  alt={`Reviewing ${current.file.name}`}
                />
                <p className="help-line" style={{ overflowWrap: "anywhere" }}>
                  {current.file.name} ·{" "}
                  {(current.file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <form
                key={current.id}
                ref={form}
                onSubmit={(e) => {
                  e.preventDefault();
                  save(new FormData(e.currentTarget));
                }}
              >
                <Eyebrow>THE DETAILS CAN BE SIMPLE</Eyebrow>
                <h2 style={{ fontSize: 40, margin: "15px 0 25px" }}>
                  What do you know?
                </h2>
                <label className="field">
                  <span>Who?</span>
                  <input
                    name="who"
                    placeholder="A name, or an unknown face"
                    list="bulk-people"
                    maxLength={300}
                  />
                </label>
                <datalist id="bulk-people">
                  {people.map((p) => (
                    <option
                      value={
                        p.category === "Unidentified"
                          ? "Unknown person"
                          : p.name
                      }
                      key={p.id}
                    />
                  ))}
                </datalist>
                <div className="field-row">
                  <label className="field">
                    <span>When?</span>
                    <input
                      name="when"
                      type={
                        precision === "exact"
                          ? "date"
                          : precision === "year"
                            ? "number"
                            : "text"
                      }
                      placeholder="e.g. 1956"
                      disabled={precision === "unknown"}
                      min={precision === "year" ? "1000" : undefined}
                      max={precision === "year" ? "2100" : undefined}
                    />
                  </label>
                  <label className="field">
                    <span>Certainty</span>
                    <select
                      name="precision"
                      value={precision}
                      onChange={(e) => setPrecision(e.target.value)}
                    >
                      <option value="approximate">Approximate</option>
                      <option value="exact">Exact date</option>
                      <option value="year">Rough year</option>
                      <option value="unknown">Unknown</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Where?</span>
                  <input
                    name="where"
                    placeholder="A place, if you know it"
                    maxLength={300}
                  />
                </label>
                <label className="field">
                  <span>Notes</span>
                  <textarea
                    name="notes"
                    placeholder="Anything you remember…"
                    maxLength={10000}
                  />
                </label>
                <button className="button" type="submit">
                  {index === files.length - 1
                    ? "Save & finish demo"
                    : "Save & next"}
                  <ArrowRight size={16} />
                </button>
                <p className="help-line">
                  Details are reported by family. You can leave any field blank.
                </p>
              </form>
            </div>
          ) : (
            <p role="status" className="notice">
              Preparing {ready} of {files.length} local image previews…
            </p>
          )}
          {!complete && records.length > 0 && (
            <div className="small-actions">
              <button
                onClick={() =>
                  downloadDraft({ status: "partial_local_demo_batch", records })
                }
              >
                Export reviewed details so far
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="demo-note">
        This is a desktop capture concept. Previews and catalogue details remain
        in memory, so refreshing clears them. In the connected archive, upload
        progress will follow durable storage receipts and catalogue changes will
        save to your private archive.
      </p>
    </div>
  );
}
