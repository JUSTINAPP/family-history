"use client";
import { useState } from "react";
import type { AudioMetadata } from "@/lib/audio/validation";
export function AudioMetadataFields({
  value,
  onChange,
  people,
  items,
  relatedPeople,
  relatedItems,
  onPeople,
  onItems,
  disabled = false,
  memory = false,
}: {
  value: AudioMetadata;
  onChange: (value: AudioMetadata) => void;
  people: { id: string; name: string }[];
  items: { id: string; title: string }[];
  relatedPeople: string[];
  relatedItems: string[];
  onPeople: (ids: string[]) => void;
  onItems: (ids: string[]) => void;
  disabled?: boolean;
  memory?: boolean;
}) {
  const [tags, setTags] = useState(value.tags.join(", "));
  const field = (key: keyof AudioMetadata, label: string, max = 300) => (
    <label className="field">
      <span>{label}</span>
      <input
        value={String(value[key] || "")}
        maxLength={max}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      />
    </label>
  );
  if (memory) return <div className="audio-metadata">
    {field("speaker", "Who is speaking? (for example, Jan or Jan and Craig)")}
    <fieldset className="memory-people"><legend>People linked to this memory (optional)</legend>
      {people.map(p => <label key={p.id}><input type="checkbox" disabled={disabled} checked={relatedPeople.includes(p.id)} onChange={e => onPeople(e.target.checked ? [...relatedPeople, p.id] : relatedPeople.filter(id => id !== p.id))} />{p.name}</label>)}
      {!people.length && <p className="help-line">People can be linked later.</p>}
    </fieldset>
    <details><summary>More details (optional)</summary>{field("title", "Title")}
      <label className="field"><span>About this memory</span><textarea disabled={disabled} value={value.description} maxLength={20000} onChange={e => onChange({...value, description: e.target.value})} /></label>
    </details>
  </div>;
  return (
    <details className="audio-metadata" open={memory || undefined}>
      <summary>{memory ? "Who is speaking, and who is this memory about?" : "Add names, dates or context (optional)"}</summary>
      {field("title", "Title")}
      {field("speaker", memory ? "Who is speaking? (for example, Jan or Jan and Craig)" : "Speaker")}
      <label className="field">
        <span>Speaker’s person record</span>
        <select
          disabled={disabled}
          value={value.speakerPersonId}
          onChange={(e) =>
            onChange({ ...value, speakerPersonId: e.target.value })
          }
        >
          <option value="">Not linked</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {field("recordedDate", "Recorded date")}
      <label className="field">
        <span>Date certainty</span>
        <select
          value={value.precision}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, precision: e.target.value })}
        >
          {["unknown", "approximate", "exact", "year"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      {field("location", "Location", 1000)}
      <label className="field">
        <span>Description / context</span>
        <textarea
          value={value.description}
          maxLength={20000}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Tags (comma separated)</span>
        <input
          value={tags}
          maxLength={2000}
          disabled={disabled}
          onChange={(e) => {
            setTags(e.target.value);
            onChange({
              ...value,
              tags: e.target.value
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
        />
      </label>
      <fieldset className="memory-people"><legend>People linked to this memory</legend>
        {people.map(p => <label key={p.id}><input type="checkbox" disabled={disabled} checked={relatedPeople.includes(p.id)} onChange={e => onPeople(e.target.checked ? [...relatedPeople, p.id] : relatedPeople.filter(id => id !== p.id))} />{p.name}</label>)}
        {!people.length && <p className="help-line">People can be added to the archive later.</p>}
      </fieldset>
      <label className="field">
        <span>Related archive items</span>
        <select
          multiple
          disabled={disabled}
          value={relatedItems}
          onChange={(e) =>
            onItems(Array.from(e.target.selectedOptions, (o) => o.value))
          }
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title}
            </option>
          ))}
        </select>
      </label>
      <p className="help-line">
        Leave every field blank if you wish. Use the selection controls to link
        existing archive records; names alone remain reported text.
      </p>
    </details>
  );
}
