"use server";
import { loadWorkspace, requireSession } from "./repository";
import { loadPlaceData } from "./places";
import { quickContext } from "./quick-catalogue";
import { loadRecordings } from "../audio/repository";
import { UUID_PATTERN } from "./validation";

export async function loadCardDetails(archiveId: string, itemId: string) {
  try {
    if (![archiveId, itemId].every(id => UUID_PATTERN.test(id))) throw new Error();
    const snapshot = await loadWorkspace({materialOnly: true, archiveId});
    const item = snapshot?.catalogue.find(item => item.id === itemId && !item.archivedAt && item.ingestionStatus === "ready");
    if (!snapshot || snapshot.archive.id !== archiveId || !item || !snapshot.peopleLinksAvailable) throw new Error();
    const {client} = await requireSession();
    const [context, places, recordings] = await Promise.all([
      quickContext(archiveId, [itemId]), loadPlaceData(archiveId, itemId), loadRecordings(client, archiveId, itemId),
    ]);
    const role = snapshot.members.find(member => member.profileId === snapshot.profileId && member.status === "active")?.role || "viewer";
    return {data: {item, people: snapshot.people, identifications: context.identifications, places: places.places, links: places.links,
      recordings, role, profileId: snapshot.profileId,
      editable: ["editor", "admin"].includes(role) || (role === "contributor" && item.contributedBy === snapshot.profileId && item.certainty !== "verified")}};
  } catch {return {error: "Details could not load. Please retry."};}
}
