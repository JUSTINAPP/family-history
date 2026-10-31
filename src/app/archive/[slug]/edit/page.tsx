import { loadRecordings } from "@/lib/audio/repository";
import { notFound, redirect } from "next/navigation";
import { loadItem, requireSession } from "@/lib/backend/repository";
import { isDemoMode } from "@/lib/supabase/config";
import { can } from "@/lib/permissions";
import { PageIntro, ArchiveImage } from "@/components/ui";
import { ItemEditor } from "@/components/live/item-editor";
export const metadata = { title: "Edit archive item" };
export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ batch?: string }>;
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
  if (item.kind === "Audio") {
    const [audio] = await loadRecordings(client, item.archive_id, item.id);
    if (!audio) notFound();
    redirect(`/audio/${audio.id}/edit`);
  }
  const batchId = (await searchParams).batch;
  if (batchId) {
    const { data, error } = await client
      .from("import_batch_items")
      .select("item_id")
      .eq("batch_id", batchId)
      .eq("item_id", item.id)
      .eq("archive_id", item.archive_id)
      .maybeSingle();
    if (error || !data) notFound();
  }
  let nextId: string | undefined;
  if (item.kind === "Photograph" || batchId) {
    const { data, error } = await client.rpc("next_uncatalogued_photograph", {
      p_archive_id: item.archive_id,
      p_item_id: item.id,
      p_batch_id: batchId || null,
    });
    if (!error) nextId = data || undefined;
  } else {
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
    const { data } = await query;
    nextId = data?.[0]?.id;
  }
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
          <ItemEditor
            key={item.id}
            item={item}
            nextId={nextId}
            batchId={batchId}
          />
        </section>
      </div>
    </div>
  );
}
