"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../workspace-provider";
import { can } from "@/lib/permissions";
import { addRecollectionAction } from "@/lib/backend/actions";
export function AddRecollection({
  archiveId,
  itemId,
}: {
  archiveId: string;
  itemId: string;
}) {
  const { role } = useWorkspace();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!can(role, "commenter")) return null;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const form = e.currentTarget;
        const data = new FormData(form);
        const error = await addRecollectionAction(
          archiveId,
          itemId,
          String(data.get("text") || ""),
        );
        setError(error || "");
        setBusy(false);
        if (!error) {
          form.reset();
          router.refresh();
        }
      }}
    >
      <label className="field" style={{ marginTop: 25 }}>
        <span>Add a recollection</span>
        <textarea
          name="text"
          required
          maxLength={20000}
          placeholder="In your own words…"
        />
      </label>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy}>
        {busy ? "Saving…" : "Save recollection"}
      </button>
    </form>
  );
}
