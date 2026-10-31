"use client";
import { useImportSelection } from "./import-selection";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Camera,
  Upload,
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  X,
  Plus,
  Check,
  Mic,
  Type,
  Zap,
  Users,
  CalendarDays,
  MapPin,
  Shapes,
} from "lucide-react";
import { LocalSourcePreview } from "./local-source-preview";
import { PageIntro } from "./ui";
import { VoiceRecollection, type VoiceValue } from "./voice-recollection";
import { SuggestionPreview } from "./suggestion-preview";
import { useWorkspace } from "./workspace-provider";
import { validateFiles } from "@/lib/capture";
import { previewSuggestions } from "@/lib/suggestions";
import { sampleRecollection } from "@/lib/demo-workspace";
import { useCatalogue } from "./catalogue";
import { can } from "@/lib/permissions";
import type {
  CaptureKind,
  SourceFile,
  Suggestion,
} from "@/lib/workspace-types";
const kinds: CaptureKind[] = [
  "Photograph",
  "Letter",
  "Document",
  "Object",
  "Postcard",
  "Certificate",
  "Artwork",
  "Other",
];
const emptyVoice: VoiceValue = {
  machineTranscript: "",
  editedTranscript: null,
};
export function Capture() {
  const workspace = useWorkspace();
  const importSelection = useImportSelection();
  const [groupedPhotograph, setGroupedPhotograph] = useState(false);
  const { people } = useCatalogue();
  const router = useRouter();
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [kind, setKind] = useState<CaptureKind>("Photograph");
  const [rapid, setRapid] = useState(false);
  const [written, setWritten] = useState("");
  const [voice, setVoice] = useState<VoiceValue>(emptyVoice);
  const [mode, setMode] = useState(
    workspace.mode === "live" ? "text" : "voice",
  );
  const [quick, setQuick] = useState<Record<string, string>>({
    precision: "approximate",
  });
  const [quickPanel, setQuickPanel] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [session, setSession] = useState(0);
  const [activeImage, setActiveImage] = useState(0);
  const camera = useRef<HTMLInputElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const letter = kind === "Letter";
  const contextText = [
    written,
    voice.editedTranscript ?? voice.machineTranscript,
  ]
    .filter(Boolean)
    .join("\n\n");
  function add(list: FileList | null) {
    if (!list) return;
    const result = validateFiles(Array.from(list));
    setError(result.error);
    const additions = result.accepted.map((file, i) => {
      const url = URL.createObjectURL(file);
      workspace.registerUrl(url);
      return {
        id: crypto.randomUUID(),
        file,
        url,
        originalName: file.name,
        role: letter
          ? "page"
          : kind === "Object"
            ? files.length + i === 0
              ? "Front"
              : "Detail"
            : "image",
      };
    });
    setFiles((old) => [...old, ...additions]);
    if (camera.current) camera.current.value = "";
    if (upload.current) upload.current.value = "";
  }
  function move(i: number, delta: number) {
    setFiles((old) => {
      const next = [...old];
      [next[i], next[i + delta]] = [next[i + delta], next[i]];
      return next;
    });
    setActiveImage(0);
  }
  async function save(view: boolean) {
    if (!files.length) return;
    if (kind === "Photograph" && files.length > 1 && !groupedPhotograph) {
      setError(
        "Choose separate photographs or views of one item before saving.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const id = await workspace.saveCapture({
        kind,
        title: letter
          ? "A newly captured letter"
          : kind === "Object"
            ? "An object worth keeping"
            : `${kind}, still to be catalogued`,
        files,
        recollection: {
          id: crypto.randomUUID(),
          contributorId: workspace.profileId,
          recordedAt: voice.recordedAt || new Date().toISOString(),
          originalText: written,
          audioSource: voice.audioSource,
          audioOriginalName: voice.audioSource
            ? "example-recollection.wav"
            : undefined,
          machineTranscript: voice.machineTranscript,
          editedTranscript: voice.editedTranscript,
        },
        quick,
        suggestions,
      });
      if (!id) {
        setError("Contributor access is required to capture material.");
        return;
      }
      if (view) {
        router.push(`/add/saved/${id}`);
        return;
      }
      setSavedId(id);
      setFiles([]);
      setGroupedPhotograph(false);
      setActiveImage(0);
      setWritten("");
      setVoice(emptyVoice);
      setSuggestions([]);
      setShowSuggestions(false);
      setQuick({ precision: "approximate" });
      setQuickPanel("");
      setSession((s) => s + 1);
      setError("");
      if (rapid) camera.current?.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The upload could not finish. Keep your originals and try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  const active = files[Math.min(activeImage, files.length - 1)];
  if (!can(workspace.role, "contributor"))
    return (
      <div className="capture-shell">
        <PageIntro
          eyebrow="ARCHIVE ACCESS"
          title="A place to contribute."
          description="Your current role can browse this archive. Capturing material requires Contributor, Editor or Admin access."
        />
        <Link className="text-link" href="/admin">
          Change demo access preview
          <ArrowUpRight size={16} />
        </Link>
      </div>
    );
  return (
    <div className="capture-studio">
      <input
        ref={camera}
        type="file"
        accept="image/*,.heic,.heif"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-label="Take a photo"
        onChange={(e) => add(e.target.files)}
      />
      <input
        ref={upload}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload existing images"
        onChange={(e) => add(e.target.files)}
      />
      <nav className="import-actions" aria-label="Add to archive options">
        <span aria-current="page">Add one item</span>
        <Link className="text-link" href="/add/bulk?workflow=import">
          Bulk import photographs ↗
        </Link>
        <Link className="text-link" href="/add/voice">
          Voice recording ↗
        </Link>
      </nav>
      <p className="help-line">
        Keep pages, front/back or several views of one item together here.
        Import separate photographs through Bulk import photographs.
      </p>
      <div className="capture-heading">
        <div>
          <p className="eyebrow">A LITTLE MORE OF OUR STORY</p>
          <h1>
            {files.length
              ? letter
                ? "Every page, kept together."
                : "A moment worth keeping."
              : "Capture first. Stories follow."}
          </h1>
        </div>
        <div className="capture-counter">
          <span>
            {workspace.capturedCount}{" "}
            {workspace.capturedCount === 1 ? "item" : "items"} captured
          </span>
          <label className="rapid-toggle">
            <input
              type="checkbox"
              checked={rapid}
              onChange={(e) => setRapid(e.target.checked)}
            />
            <Zap size={15} />
            Rapid capture
          </label>
        </div>
      </div>
      <p>
        <Link href="/add/voice" className="text-link">
          Voice recording ↗
        </Link>
      </p>
      {savedId && !files.length && (
        <div className="saved-inline" role="status">
          <Check size={19} />
          <div>
            <strong>
              {workspace.mode === "live"
                ? "Saved to your archive."
                : "Saved in this demo session."}
            </strong>
            <p>
              {workspace.mode === "live"
                ? "Originals preserved; display processing is queued. Ready for the next one."
                : "Processing carries on in the background. Ready for the next one."}
            </p>
          </div>
          <Link href={`/add/saved/${savedId}`}>View item ↗</Link>
        </div>
      )}
      {kind === "Photograph" && files.length > 1 && !groupedPhotograph && (
        <section
          className="notice"
          aria-label="How should these photographs be kept?"
        >
          <h2>Separate photographs, or views of one photograph?</h2>
          <p>
            Separate photographs each get their own place in the archive. Front
            and back can stay together as one item.
          </p>
          <div className="import-actions">
            <button
              className="button"
              onClick={() => {
                importSelection.stage(
                  workspace.archive.id,
                  files.map((source) => source.file),
                );
                router.push("/add/bulk?workflow=import");
              }}
            >
              Import as separate photographs
            </button>
            <button
              className="subtle-button"
              onClick={() => {
                setGroupedPhotograph(true);
                setError("");
              }}
            >
              Keep together as one item
            </button>
          </div>
        </section>
      )}
      {kind === "Photograph" && files.length > 1 && groupedPhotograph && (
        <p className="help-line">
          These {files.length} views will be saved as one item.{" "}
          <button
            className="subtle-button"
            onClick={() => setGroupedPhotograph(false)}
          >
            Change this choice
          </button>
        </p>
      )}
      {!files.length ? (
        <>
          <section className="capture-start">
            <span className="capture-start-number">
              01 / BEGIN WITH THE MATERIAL
            </span>
            <Camera size={52} strokeWidth={1} />
            <h2>
              {letter
                ? "Start with page one."
                : rapid
                  ? "A whole box. One at a time."
                  : "What have you found?"}
            </h2>
            <p>
              {letter
                ? "Photograph the first page. Add the rest, and the envelope, whenever you’re ready."
                : "No need for names or dates yet. A clear photo is a good beginning."}
            </p>
            <div className="capture-entry-actions">
              <button
                className="button"
                onClick={() => camera.current?.click()}
              >
                <Camera size={21} />
                {letter ? "Photograph page 1" : "Take photo"}
              </button>
              <button
                className="button button-light"
                onClick={() => upload.current?.click()}
              >
                <Upload size={20} />
                Upload existing
              </button>
            </div>
            <div className="capture-presets">
              <button
                className={letter ? "selected" : ""}
                aria-pressed={letter}
                onClick={() => setKind(letter ? "Photograph" : "Letter")}
              >
                Adding a letter? Start a letter
              </button>
              <Link href="/add/bulk">
                Bulk upload
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>
          <div className="capture-reassurance">
            <span>Capture → tell us what you know → save → next.</span>
            <p>
              {workspace.mode === "live"
                ? "Files stay on your device until Save. Originals then upload unchanged to private Storage."
                : "Your files stay on this device in the demo. Nothing is uploaded."}
            </p>
            {rapid && (
              <p>
                Rapid capture opens the camera after Save & next, where your
                browser supports it. You can always choose Take photo again.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="capture-workspace">
            <section
              className="capture-material"
              aria-label="Captured material"
            >
              <div className="capture-main-image">
                <LocalSourcePreview
                  file={active.file}
                  url={active.url}
                  alt={`Original local preview of ${active.originalName}`}
                />
                <span className="material-label">
                  ORIGINAL · {active.originalName}
                </span>
              </div>
              <div className="capture-pages">
                {files.map((file, i) => (
                  <div
                    key={file.id}
                    className={`capture-page ${i === activeImage ? "selected" : ""}`}
                  >
                    <button
                      className="capture-page-image"
                      aria-label={`Preview image ${i + 1}`}
                      onClick={() => setActiveImage(i)}
                    >
                      <LocalSourcePreview
                        file={file.file}
                        url={file.url}
                        alt=""
                      />
                    </button>
                    <div>
                      <label>
                        <span className="sr-only">
                          Role for {file.originalName}
                        </span>
                        <select
                          value={file.role}
                          onChange={(e) =>
                            setFiles((old) =>
                              old.map((f) =>
                                f.id === file.id
                                  ? { ...f, role: e.target.value }
                                  : f,
                              ),
                            )
                          }
                        >
                          {letter ? (
                            <>
                              <option value="page">
                                Page{" "}
                                {
                                  files
                                    .slice(0, i + 1)
                                    .filter((f) => f.role === "page").length
                                }
                              </option>
                              <option value="envelope-front">
                                Envelope front
                              </option>
                              <option value="envelope-back">
                                Envelope back
                              </option>
                            </>
                          ) : kind === "Object" ? (
                            [
                              "Front",
                              "Back",
                              "Detail",
                              "Inscription",
                              "Other view",
                            ].map((r) => <option key={r}>{r}</option>)
                          ) : (
                            <>
                              <option value="image">Image {i + 1}</option>
                              <option value="reverse">Back / reverse</option>
                              <option value="detail">Detail</option>
                            </>
                          )}
                        </select>
                      </label>
                      <div className="page-order-actions">
                        <button
                          disabled={i === 0}
                          aria-label={`Move ${file.originalName} earlier`}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          disabled={i === files.length - 1}
                          aria-label={`Move ${file.originalName} later`}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          aria-label={`Remove ${file.originalName}`}
                          onClick={() => {
                            setFiles((old) =>
                              old.filter((f) => f.id !== file.id),
                            );
                            setActiveImage(0);
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="add-source-buttons">
                <button
                  className="subtle-button"
                  onClick={() => camera.current?.click()}
                >
                  <Plus size={17} />
                  {letter ? "Add another page" : "Add another image / page"}
                </button>
                <button
                  className="subtle-button"
                  onClick={() => upload.current?.click()}
                >
                  Choose existing
                </button>
              </div>
              <p className="help-line">
                {letter
                  ? "Keep pages in reading order. Add envelope front and back with the page controls."
                  : "Photograph the reverse or a detail, too, if it tells us something."}{" "}
                Originals are never edited.
              </p>
            </section>
            <section className="capture-context">
              <p className="eyebrow">02 / A LITTLE OF WHAT YOU KNOW</p>
              <h2>
                What do you know
                <br />
                about {letter ? "this letter" : "this"}?
              </h2>
              <p className="context-reassurance">
                Nothing has to be certain. You can leave everything for later.
              </p>
              <div
                className="context-mode"
                aria-label="How would you like to add context?"
              >
                <button
                  className={mode === "voice" ? "selected" : ""}
                  aria-pressed={mode === "voice"}
                  onClick={() => setMode("voice")}
                >
                  <Mic size={18} />
                  Tell us
                </button>
                <button
                  className={mode === "text" ? "selected" : ""}
                  aria-pressed={mode === "text"}
                  onClick={() => setMode("text")}
                >
                  <Type size={17} />
                  Type instead
                </button>
              </div>
              <div hidden={mode !== "voice"}>
                {workspace.mode === "demo" ? (
                  <VoiceRecollection key={session} onChange={setVoice} />
                ) : (
                  <p className="notice">
                    Save the photograph first, then choose Add a voice
                    recollection on its item page. You can also{" "}
                    <Link href="/add/voice">
                      make a standalone voice recording
                    </Link>
                    .
                  </p>
                )}
              </div>
              <div hidden={mode !== "text"} className="written-recollection">
                <label className="field">
                  <span>Your recollection, in your words</span>
                  <textarea
                    value={written}
                    onChange={(e) => setWritten(e.target.value)}
                    placeholder="A name, a memory, something written on the back…"
                    maxLength={10000}
                  />
                </label>
                {workspace.mode === "demo" && (
                  <button
                    className="subtle-button"
                    onClick={() => setWritten(sampleRecollection)}
                  >
                    Try the example recollection
                  </button>
                )}
                <p className="help-line">
                  Your own words stay separate from any machine interpretation.
                </p>
              </div>
              <div className="quick-controls">
                <p className="eyebrow">A FEW DETAILS, ONLY IF YOU LIKE</p>
                <div className="quick-buttons">
                  {[
                    { name: letter ? "Written by" : "People", icon: Users },
                    { name: letter ? "Sent to" : "When", icon: CalendarDays },
                    { name: "Where", icon: MapPin },
                    { name: "Item type", icon: Shapes },
                    ...(letter ? [{ name: "When", icon: CalendarDays }] : []),
                  ].map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      aria-expanded={quickPanel === name}
                      onClick={() =>
                        setQuickPanel(quickPanel === name ? "" : name)
                      }
                    >
                      <Icon size={15} />
                      {name}
                    </button>
                  ))}
                </div>
                {quickPanel && (
                  <div className="quick-panel">
                    {quickPanel === "Item type" ? (
                      <label className="field">
                        <span>Item type</span>
                        <select
                          value={kind}
                          onChange={(e) => {
                            setKind(e.target.value as CaptureKind);
                            setFiles((old) =>
                              old.map((f) => ({
                                ...f,
                                role:
                                  e.target.value === "Letter"
                                    ? "page"
                                    : e.target.value === "Object"
                                      ? "Front"
                                      : "image",
                              })),
                            );
                            setSuggestions([]);
                            setShowSuggestions(false);
                          }}
                        >
                          {kinds.map((k) => (
                            <option key={k}>{k}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <>
                        <label className="field">
                          <span>{quickPanel}</span>
                          <input
                            list={
                              ["People", "Written by", "Sent to"].includes(
                                quickPanel,
                              )
                                ? "capture-people"
                                : undefined
                            }
                            type={
                              quickPanel === "When" &&
                              quick.precision === "exact"
                                ? "date"
                                : quickPanel === "When" &&
                                    quick.precision === "year"
                                  ? "number"
                                  : "text"
                            }
                            disabled={
                              quickPanel === "When" &&
                              quick.precision === "unknown"
                            }
                            value={quick[quickPanel] || ""}
                            onChange={(e) =>
                              setQuick({
                                ...quick,
                                [quickPanel]: e.target.value,
                              })
                            }
                            placeholder={
                              quickPanel === "When"
                                ? "e.g. 1963, or sometime in the 1960s"
                                : "Anything you know is welcome"
                            }
                            maxLength={300}
                          />
                        </label>
                        {quickPanel === "When" && (
                          <label className="field">
                            <span>How sure are you?</span>
                            <select
                              value={quick.precision}
                              onChange={(e) =>
                                setQuick({
                                  ...quick,
                                  precision: e.target.value,
                                  When: "",
                                })
                              }
                            >
                              <option value="approximate">
                                An approximate date
                              </option>
                              <option value="year">A rough year</option>
                              <option value="exact">An exact date</option>
                              <option value="unknown">I’m not sure</option>
                            </select>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                )}
                <datalist id="capture-people">
                  {people.map((p) => (
                    <option value={p.name} key={p.id} />
                  ))}
                  <option value="Unknown person" />
                </datalist>
              </div>
              {contextText && workspace.settings.ai && (
                <button
                  className="suggestion-invite"
                  onClick={() => {
                    setSuggestions(previewSuggestions(contextText, kind));
                    setShowSuggestions(true);
                  }}
                >
                  Find a few details in my words
                  <ArrowUpRight size={17} />
                </button>
              )}
            </section>
          </div>
          {showSuggestions && (
            <SuggestionPreview
              suggestions={suggestions}
              onChange={setSuggestions}
              onClose={() => setShowSuggestions(false)}
            />
          )}
          <div className="capture-save-bar">
            <div>
              <strong>No more details needed.</strong>
              <p>
                {letter
                  ? "Your letter can process while you keep capturing."
                  : "You can always come back to the story."}
              </p>
            </div>
            <button
              className="button button-light"
              disabled={
                saving ||
                (kind === "Photograph" &&
                  files.length > 1 &&
                  !groupedPhotograph)
              }
              onClick={() => save(true)}
            >
              Save & view
              <ArrowUpRight size={17} />
            </button>
            <button
              className="button"
              disabled={
                saving ||
                (kind === "Photograph" &&
                  files.length > 1 &&
                  !groupedPhotograph)
              }
              onClick={() => save(false)}
            >
              Save & next
              <Camera size={18} />
            </button>
          </div>
          <p className="help-line capture-local-note">
            {workspace.mode === "live"
              ? "Original files and written recollections save to your private archive. Voice remains an example and is not stored."
              : "Demo session only · keep your originals. Saving keeps previews,"}
            {workspace.mode === "demo"
              ? "recollections and proposed details in memory until you reload."
              : ""}
          </p>
        </>
      )}
      {saving && (
        <p className="notice" role="status">
          Uploading unchanged originals to private Storage. Keep this page open.
          Saving the recollection and confirming receipts…
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
