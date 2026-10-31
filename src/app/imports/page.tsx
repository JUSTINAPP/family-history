import Link from "next/link";
import { notFound } from "next/navigation";
import { loadWorkspace, requireSession } from "@/lib/backend/repository";
import { PageIntro } from "@/components/ui";
import { isDemoMode } from "@/lib/supabase/config";
export default async function ImportsPage() {
  if (isDemoMode()) notFound();
  const snapshot = await loadWorkspace();
  if (!snapshot) notFound();
  const { client } = await requireSession();
  const { data, error } = await client
    .from("import_batches")
    .select("*")
    .eq("archive_id", snapshot.archive.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Import history could not be loaded.");
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="PHOTOGRAPH IMPORTS"
        title="Every import, kept track of."
        description="Open a batch to browse preserved photographs or resume an unfinished import."
      />
      <ul className="import-list">
        {data?.map((batch) => (
          <li key={batch.id}>
            <Link href={`/imports/${batch.id}`}>
              {batch.context || "Photograph import"} ↗
            </Link>
            <span>
              {batch.expected_count} photographs ·{" "}
              {new Date(batch.created_at).toLocaleDateString("en-AU", {
                timeZone: "Australia/Sydney",
              })}
            </span>
          </li>
        ))}
      </ul>
      <Link className="text-link" href="/add/bulk?workflow=import">
        Import photographs ↗
      </Link>
    </div>
  );
}
