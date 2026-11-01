import { SharedContextReview } from "@/components/live/shared-context-review";
import { loadItem } from "@/lib/backend/repository";
import { notFound } from "next/navigation";
import { isDemoMode } from "@/lib/supabase/config";
import { managementSnapshot } from "@/lib/backend/item-management";
import { ItemManager } from "@/components/live/item-manager";
import { BackendError } from "@/lib/backend/errors";
import { PageIntro } from "@/components/ui";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Manage archive item" };
export default async function ManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ split?: string }>;
}) {
  if (isDemoMode()) notFound();
  const snapshot = await managementSnapshot((await params).slug).catch(
    (error) => {
      if (error instanceof BackendError && error.status === 403) notFound();
      throw error;
    },
  );
  const source = snapshot.children.length ? await loadItem(snapshot.item.id) : null;
  const notes = source ? [
    ...source.recollections.filter(r => r.original_text?.trim()).map(r => ({id: r.id, text: r.original_text, kind: "recollection" as const})),
    ...source.identifications.filter(i => i.person_id && ["reported", "accepted"].includes(i.status)).map(i => ({id: i.id, text: source.snapshot.people.find(p => p.id === i.person_id)?.name || i.proposed_name, kind: "person" as const})),
  ] : [];
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="ITEM MANAGEMENT"
        title={snapshot.item.title}
        description="Preserve, separate or deliberately remove material from this private archive."
      />
      <ItemManager
        snapshot={snapshot}
        initialSplit={(await searchParams).split === "1"}
      />
      <SharedContextReview source={snapshot.item.id} photographs={snapshot.children} notes={notes} />
    </div>
  );
}
