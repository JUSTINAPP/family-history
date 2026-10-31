"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { suggestIdentificationAction } from "@/lib/backend/actions";
import { useWorkspace } from "../workspace-provider";
import { can } from "@/lib/permissions";
export function IdentificationForm({
  archiveId,
  itemId,
}: {
  archiveId: string;
  itemId: string;
}) {
  const { role } = useWorkspace();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (!can(role, "commenter")) return null;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        try {
          const error = await suggestIdentificationAction(
            archiveId,
            itemId,
            String(new FormData(form).get("name") || ""),
          );
          setMessage(error || "Identification recorded as a suggestion.");
          if (!error) {
            form.reset();
            router.refresh();
          }
        } catch {
          setMessage("Identification could not be saved. Please retry.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="field">
        <span>Suggest an identification</span>
        <input
          name="name"
          required
          maxLength={200}
          placeholder="Who do you recognise?"
        />
      </label>
      <button className="subtle-button" disabled={busy}>
        {busy ? "Saving…" : "Save identification suggestion"}
      </button>
      {message && (
        <p role="status" className="help-line">
          {message}
        </p>
      )}
    </form>
  );
}
