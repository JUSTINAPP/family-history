"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createArchiveAction } from "@/lib/backend/actions";
import { PageIntro } from "../ui";
export function CreateArchive() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="capture-shell">
      <PageIntro
        eyebrow="A PLACE TO BEGIN"
        title="Your archive, your story."
        description="Create a private archive. Your authenticated account becomes its first Admin; no fictional records are added."
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const result = await createArchiveAction(
            new FormData(e.currentTarget),
          );
          setBusy(false);
          if (result.error) setError(result.error);
          else {
            router.push("/");
            router.refresh();
          }
        }}
      >
        <label className="field">
          <span>Archive name</span>
          <input
            name="name"
            defaultValue="The Allen & Cork Archive"
            required
            maxLength={120}
          />
        </label>
        <label className="field">
          <span>Archive slug</span>
          <input
            name="slug"
            defaultValue="the-allen-and-cork-archive"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={80}
          />
        </label>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Creating…" : "Create private archive"}
        </button>
      </form>
    </div>
  );
}
