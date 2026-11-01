"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveQuickField } from "@/lib/backend/quick-actions";
import { historicalDate } from "@/lib/conversation";
export function QuickField({archiveId, itemId, field, value, precision = "unknown", editable}: {
  archiveId: string; itemId: string; field: "date" | "caption"; value: string; precision?: string; editable: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [mode, setMode] = useState(precision);
  const [expected, setExpected] = useState<{value: string; precision?: string}>({value, ...(field === "date" ? {precision} : {})});
  const label = field === "date" ? "When" : "Caption";
  const hints: Record<string, string> = {exact: "1984-03-12", month: "1984-03", year: "1984", approximate: "1984", decade: "1980s", unknown: ""};
  return <section className="quick-field" aria-label={label}>
    <h2>{label}</h2>
    <p>{field === "date" ? historicalDate(value, precision) : value || "No caption yet"}</p>
    {editable && !open && <button className="subtle-button" onClick={() => {setExpected(field === "date" ? {value, precision} : {value}); setOpen(true); setMode(precision);}}>Edit {field === "date" ? "date" : "caption"}</button>}
    {open && <form onSubmit={async e => {
      e.preventDefault(); setBusy(true); setMessage("");
      const data = new FormData(e.currentTarget);
      data.set("field", field);
      data.set("expected", JSON.stringify(expected));
      if (field === "date" && mode === "unknown") data.set("value", "");
      try {
        const result = await saveQuickField(archiveId, itemId, data);
        if (result.error) setMessage(result.error);
        else {setMessage(`${label === "When" ? "Date" : "Caption"} saved.`); setOpen(false); router.refresh();}
      } catch {setMessage("Could not save. Your changes are still here; please retry.");}
      finally {setBusy(false);}
    }}>
      {field === "date" && <label className="field">Date precision<select aria-label="Date precision" name="precision" value={mode} onChange={e => setMode(e.target.value)}>
        <option value="unknown">Unknown</option><option value="exact">Exact date</option><option value="month">Month and year</option>
        <option value="year">Year</option><option value="approximate">Approximate year</option><option value="decade">Decade</option>
      </select></label>}
      {(field === "caption" || mode !== "unknown") && <label className="field">{field === "date" ? "Date" : "Title / caption"}
        <input name="value" defaultValue={value} placeholder={field === "date" ? hints[mode] : "A little about this moment"}
          type={field === "date" && mode === "exact" ? "date" : field === "date" && mode === "month" ? "month" : "text"}
          maxLength={field === "date" ? 30 : 300} required={field === "date"} />
      </label>}
      <button className="button" disabled={busy}>Save {field === "date" ? "date" : "caption"}</button>
      <button type="button" className="subtle-button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
    </form>}
    {message && <p role="status">{message}</p>}
  </section>;
}
