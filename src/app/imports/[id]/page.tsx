import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession, loadWorkspace } from "@/lib/backend/repository";
import { readImportBatch } from "@/lib/import-batches";
import { PageIntro, ItemCard } from "@/components/ui";
import { isDemoMode } from "@/lib/supabase/config";
export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (isDemoMode()) notFound();
  const { client } = await requireSession();
  const batch = await readImportBatch(client, (await params).id);
  if (!batch) notFound();
  const snapshot = await loadWorkspace({
    archiveId: batch.archiveId,
    batchId: batch.id,
  });
  if (!snapshot) notFound();
  const saved = batch.sources.filter((s) => s.status === "saved");
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="PHOTOGRAPH IMPORT"
        title={`${saved.length} of ${batch.expectedCount} photographs preserved.`}
        description="Import progress is kept in the archive. Original files already preserved are never removed when you close the capture page."
      />
      {batch.context && (
        <section className="notice">
          <h2>Batch context</h2>
          <p>{batch.context}</p>
          <p className="help-line">
            Context for this group, separate from each photograph’s story.
          </p>
        </section>
      )}
      <div className="import-actions">
        <Link
          className="text-link"
          href={`/explore?archive=${batch.archiveId}&batch=${batch.id}`}
        >
          View imported photographs ↗
        </Link>
        {saved[0] && (
          <Link
            className="text-link"
            href={`/archive/${saved[0].itemId}/edit?batch=${batch.id}`}
          >
            Catalogue first photograph ↗
          </Link>
        )}
        {batch.createdBy === snapshot.profileId &&
          saved.length < batch.expectedCount && (
            <Link
              className="text-link"
              href={`/add/bulk?workflow=import&batch=${batch.id}`}
            >
              Resume this import ↗
            </Link>
          )}
      </div>
      <section aria-label="Imported photographs inbox">
        <h2>Catalogue each photograph</h2>
        <p>
          Each photograph has its own title, context, people, date, place and
          catalogue state.
        </p>
        <div className="catalogue-grid">
          {snapshot.catalogue.map((item, index) => (
            <div key={item.id}>
              <ItemCard
                item={item}
                index={index}
                imageSizes="(max-width: 600px) 90vw, (max-width: 1800px) 44vw, 800px"
              />
              <p>
                <Link
                  className="text-link"
                  href={`/archive/${item.id}/edit?batch=${batch.id}`}
                >
                  Catalogue this photograph ↗
                </Link>
              </p>
            </div>
          ))}
        </div>
      </section>
      <ul className="import-list">
        {batch.sources.map((s) => (
          <li key={s.captureId}>
            <span>{s.fileName}</span>
            {s.status === "saved" ? (
              <Link href={`/archive/${s.itemId}`}>Original preserved ↗</Link>
            ) : (
              <span>Receipt incomplete · reselect original to retry</span>
            )}
          </li>
        ))}
      </ul>
      {batch.sources.length < batch.expectedCount && (
        <p>
          {batch.expectedCount - batch.sources.length} photographs have not
          reached a file reservation yet.
        </p>
      )}
    </div>
  );
}
