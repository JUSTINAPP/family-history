import { loadPlaceData } from "@/lib/backend/places";
import { PlacePicker } from "./place-picker";
export async function ItemPlaces({
  archiveId,
  itemId,
  reportedText,
  editable,
  editor,
  profileId,
}: {
  archiveId: string;
  itemId: string;
  reportedText: string;
  editable: boolean;
  editor: boolean;
  profileId: string;
}) {
  let data;
  try {
    data = await loadPlaceData(archiveId, itemId);
  } catch {
    return (
      <section className="item-people">
        <h2>Where</h2>
        <p>
          Place records could not load. Reload to retry. Original wording:{" "}
          {reportedText || "Not yet known"}.
        </p>
      </section>
    );
  }
  return (
    <PlacePicker
      {...data}
      archiveId={archiveId}
      itemId={itemId}
      reportedText={reportedText}
      editable={editable}
      editor={editor}
      profileId={profileId}
    />
  );
}
