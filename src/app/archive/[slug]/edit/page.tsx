import { notFound } from "next/navigation";
import { loadItem, requireSession } from "@/lib/backend/repository";
import { isDemoMode } from "@/lib/supabase/config";
import { can } from "@/lib/permissions";
import { PageIntro, ArchiveImage } from "@/components/ui";
import { ItemEditor } from "@/components/live/item-editor";
export const metadata = { title: "Edit archive item" };
export default async function EditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (isDemoMode()) notFound();
  const result = await loadItem((await params).slug);
  if (!result) notFound();
  const { item, snapshot, files } = result;
  const role =
    snapshot.members.find(
      (m) => m.profileId === snapshot.profileId && m.status === "active",
    )?.role || "viewer";
  if (
    !can(role, "editor") &&
    !(
      can(role, "contributor") &&
      item.contributed_by === snapshot.profileId &&
      item.evidence_status !== "verified"
    )
  )
    notFound();
  const { client } = await requireSession();
  const query = client
    .from("archive_items")
    .select("id")
    .eq("archive_id", item.archive_id)
    .eq("ingestion_status", "ready")
    .is("catalogued_at", null)
    .neq("id", item.id)
    .order("created_at")
    .order("id")
    .limit(1);
  if (!can(role, "editor"))
    query
      .eq("contributed_by", snapshot.profileId)
      .neq("evidence_status", "verified");
  const { data: next } = await query;
  const original = files.find((f) => f.purpose === "original");
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="CATALOGUE LATER"
        title="Add a little more of the story."
        description="Names and dates can be uncertain. Your original stays exactly as it was imported."
      />
      <div className="saved-material-layout">
        <section>
          {original && (
            <ArchiveImage
              src={`/api/v1/previews/${original.id}`}
              alt={item.title}
              className="saved-original"
            />
          )}
        </section>
        <section>
          <ItemEditor key={item.id} item={item} nextId={next?.[0]?.id} />
        </section>
      </div>
    </div>
  );
}
