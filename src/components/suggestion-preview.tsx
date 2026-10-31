"use client";
import { Check, X, Pencil, ArrowRight } from "lucide-react";
import { useState } from "react";
import type { Suggestion } from "@/lib/workspace-types";
export function SuggestionPreview({
  suggestions,
  onChange,
  onClose,
}: {
  suggestions: Suggestion[];
  onChange: (value: Suggestion[]) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  function patch(id: string, changes: Partial<Suggestion>) {
    onChange(suggestions.map((s) => (s.id === id ? { ...s, ...changes } : s)));
  }
  return (
    <section className="suggestion-panel">
      <p className="eyebrow">A LITTLE HELP, WHEN YOU WANT IT</p>
      <h2>We found a few details.</h2>
      <p className="help-line">
        Example interpretation of your words. Confirming records your
        recollection; it does not verify a historical fact. Nothing here changes
        the original.
      </p>
      <div className="suggestion-legend">
        <span className="status-tag">Suggested by AI · demo</span>
        <span className="status-tag uncertain">Uncertain</span>
        <span className="status-tag confirmed">Confirmed by contributor</span>
      </div>
      {suggestions.map((s) => (
        <div
          key={s.id}
          className={`suggestion-row ${s.status === "removed" ? "removed" : ""}`}
        >
          <span className="eyebrow">{s.field}</span>
          <div>
            {editing === s.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (value.trim()) {
                    patch(s.id, { value: value.trim(), status: "confirmed" });
                    setEditing(null);
                  }
                }}
              >
                <label className="field">
                  <span className="sr-only">
                    Correct {s.field.toLowerCase()} suggestion
                  </span>
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    autoFocus
                    maxLength={250}
                  />
                </label>
                <button className="subtle-button" type="submit">
                  Save correction
                </button>
                <button
                  className="subtle-button"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <>
                <p>{s.value}</p>
                <small>
                  {s.status === "confirmed"
                    ? "Confirmed by contributor · family recollection"
                    : s.status === "uncertain"
                      ? "Uncertain · needs a closer look"
                      : s.status === "removed"
                        ? "Removed from proposed details"
                        : "Suggested by AI · demo interpretation"}
                </small>
              </>
            )}
          </div>
          <div className="suggestion-actions">
            {s.status !== "removed" && editing !== s.id ? (
              <>
                <button
                  type="button"
                  aria-label={`Confirm ${s.value}`}
                  onClick={() => patch(s.id, { status: "confirmed" })}
                >
                  <Check size={17} />
                </button>
                <button
                  type="button"
                  aria-label={`Correct ${s.value}`}
                  onClick={() => {
                    setEditing(s.id);
                    setValue(s.value);
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${s.value}`}
                  onClick={() => patch(s.id, { status: "removed" })}
                >
                  <X size={17} />
                </button>
              </>
            ) : s.status === "removed" ? (
              <button
                type="button"
                className="subtle-button"
                onClick={() => patch(s.id, { status: "suggested" })}
              >
                Undo
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <button type="button" className="subtle-button" onClick={onClose}>
        Ignore for now · keep capturing
        <ArrowRight size={15} />
      </button>
    </section>
  );
}
