"use client";
import { useState } from "react";
import type { ManagementSnapshot } from "@/lib/backend/item-management";
export function ImageDiagnostics({
  files,
}: {
  files: ManagementSnapshot["files"];
}) {
  const [report, setReport] = useState(""),
    [busy, setBusy] = useState(false);
  async function measure() {
    setBusy(true);
    try {
      const results = [];
      for (const file of files
        .filter((f) => f.purpose === "display" || f.purpose === "thumbnail")
        .slice(-6)) {
        const started = performance.now();
        const response = await fetch(`/api/v1/assets/${file.id}`, {
          cache: "no-store",
        });
        const bytes = (await response.arrayBuffer()).byteLength;
        results.push({
          id: file.id,
          purpose: file.purpose,
          status: response.status,
          dimensions: `${file.width}×${file.height}`,
          declaredBytes: file.size,
          receivedBytes: bytes,
          totalMs: Math.round(performance.now() - started),
          serverTiming: response.headers.get("server-timing"),
          source: "private derived file; no signed URL",
        });
      }
      setReport(JSON.stringify(results, null, 2));
    } catch {
      setReport("Measurement interrupted; no data was changed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="image-diagnostics">
      <summary>Image delivery diagnostics</summary>
      <p>
        Stored dimensions and bytes are read from the actual archive receipts.
        Measurement downloads at most six existing derivatives; it never
        downloads a master or starts conversion.
      </p>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Dimensions</th>
            <th>Bytes</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {files
            .filter(
              (f) => f.purpose !== "original" && f.purpose !== "audio_original",
            )
            .map((f) => (
              <tr key={f.id}>
                <td>{f.purpose}</td>
                <td>
                  {f.width}×{f.height}
                </td>
                <td>{Number(f.size).toLocaleString()}</td>
                <td>{f.mime}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <button
        className="subtle-button"
        disabled={busy}
        onClick={() => void measure()}
      >
        {busy ? "Measuring…" : "Measure stored image delivery"}
      </button>
      {report && (
        <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {report}
        </pre>
      )}
    </details>
  );
}
