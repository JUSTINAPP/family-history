"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../workspace-provider";
import { can } from "@/lib/permissions";
import { savePersonAction } from "@/lib/backend/actions";
export function PeopleTools() {
  const { archive, role } = useWorkspace();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!can(role, "editor")) return null;
  return (
    <div className="page-shell" style={{ paddingBottom: 0, paddingTop: 25 }}>
      <button
        className="button button-light"
        onClick={() => dialog.current?.showModal()}
      >
        Add a person
      </button>
      <dialog
        className="admin-dialog"
        ref={dialog}
        aria-labelledby="person-title"
      >
        <button
          className="dialog-close"
          aria-label="Close person form"
          onClick={() => dialog.current?.close()}
        >
          ×
        </button>
        <h2 id="person-title">A person in the archive.</h2>
        <p className="help-line">
          This is a historical record. No login or membership is created.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = e.currentTarget;
            const error = await savePersonAction(
              archive.id,
              new FormData(form),
            );
            setError(error || "");
            setBusy(false);
            if (!error) {
              form.reset();
              dialog.current?.close();
              router.refresh();
            }
          }}
        >
          <label className="field">
            <span>Name</span>
            <input name="name" required maxLength={200} />
          </label>
          <label className="field">
            <span>Connection</span>
            <select name="category">
              <option value="family">Family</option>
              <option value="friend">Friend</option>
              <option value="other">Other</option>
              <option value="unidentified">Unidentified</option>
            </select>
          </label>
          <label className="field">
            <span>Lifespan, if known</span>
            <input name="lifespan" maxLength={150} />
          </label>
          <label className="field">
            <span>Biography</span>
            <textarea name="biography" maxLength={10000} />
          </label>
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          <button className="button" disabled={busy}>
            {busy ? "Saving…" : "Save person"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
