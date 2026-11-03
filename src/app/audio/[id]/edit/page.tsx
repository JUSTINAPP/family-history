import { notFound } from "next/navigation";
import { loadWorkspace, requireSession } from "@/lib/backend/repository";
import { loadRecordings } from "@/lib/audio/repository";
import { RecordingEditor } from "@/components/audio/recording-editor";
import { PageIntro } from "@/components/ui";
import { can } from "@/lib/permissions";
import { isDemoMode } from "@/lib/supabase/config";
export default async function AudioEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (isDemoMode()) notFound();
  const snapshot = await loadWorkspace();
  if (!snapshot) notFound();
  const { client } = await requireSession();
  const [recording] = await loadRecordings(
    client,
    snapshot.archive.id,
    undefined,
    (await params).id,
  );
  if (!recording) notFound();
  const role =
    snapshot.members.find(
      (m) => m.profileId === snapshot.profileId && m.status === "active",
    )?.role || "viewer";
  if (
    !can(role, "editor") &&
    !(
      can(role, "contributor") &&
      recording.contributorId === snapshot.profileId &&
      !recording.archived
    )
  )
    notFound();
  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="VOICE RECORDING"
        title="Add more of the story."
        description="Edit details and links while the original audio stays untouched."
      />
      <RecordingEditor
        key={recording.id}
        recording={recording}
      />
    </div>
  );
}
