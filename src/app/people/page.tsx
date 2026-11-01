import { isDemoMode } from "@/lib/supabase/config";
import { PeopleTools } from "@/components/live/people-tools";
import { People } from "@/components/people";
import { PeopleOverview } from "@/components/people-overview";
import { loadWorkspace } from "@/lib/backend/repository";
import { personMaterials } from "@/lib/people-material";
import { reportRender } from "@/lib/backend/performance";
import { notFound } from "next/navigation";
export const metadata = { title: "People" };
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ archive?: string }>;
}) {
  if (!isDemoMode()) {
    const data = await loadWorkspace({
      archiveId: (await searchParams).archive,
      materialOnly: true,
    });
    if (!data) notFound();
    const materials = personMaterials(
      data.catalogue,
      data.identifications || [],
      data.archive.id,
    );
    reportRender("people");
    return (
      <>
        <PeopleTools />
        <PeopleOverview
          people={data.people.map(({ id, slug, name, lifespan, category }) => ({
            id,
            slug,
            name,
            lifespan,
            category,
          }))}
          materials={materials}
          archiveId={data.archive.id}
          unavailable={
            !data.catalogueAvailable || data.peopleLinksAvailable === false
          }
        />
      </>
    );
  }
  return (
    <>
      {!isDemoMode() && <PeopleTools />}
      <People />
    </>
  );
}
