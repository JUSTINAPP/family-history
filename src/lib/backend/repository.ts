import { cataloguePresentation } from "../catalogue-presentation";
import "server-only";
import { cache } from "react";
import type { PersonLink } from "../people-material";
import { imageSet, type ImageSetRow } from "../preview/types";
import { cookies } from "next/headers";
import { authenticatedClient } from "@/lib/supabase/server";
import { BackendError } from "./errors";
import type { ArchiveItem, Person, MemberRole } from "@/lib/types";
import type {
  Archive,
  Member,
  Activity,
  ReviewJob,
} from "@/lib/workspace-types";
import {
  allRows,
  readCatalogue,
  catalogueItems,
  type OriginalRow,
} from "./catalogue";
interface PersonRow {
  id: string;
  archive_id: string;
  slug: string;
  display_name: string;
  category: string;
  lifespan: string;
  portrait_file_id: string | null;
  biography: string;
}
export interface LiveSnapshot {
  places?: import("../places").ArchivePlace[];
  placeLinks?: import("../places").ItemPlace[];
  placesAvailable?: boolean;
  identifications?: PersonLink[];
  peopleLinksAvailable?: boolean;
  catalogueBatchId?: string;
  catalogueLoaded: boolean;
  catalogueAvailable: boolean;
  catalogueCount: number | null;
  resourceWarnings: string[];
  profileId: string;
  profileName: string;
  profileEmail: string;
  archive: Archive;
  archives: Archive[];
  members: Member[];
  catalogue: ArchiveItem[];
  people: Person[];
  activity: Activity[];
  jobs: ReviewJob[];
}
export const requireSession = cache(async function requireSession() {
  const auth = await authenticatedClient();
  if (!auth)
    throw new BackendError(
      401,
      "Your session has expired. Sign in again; your selected files are still on this page.",
    );
  return auth;
});
const readArchives = cache(async () => {
  const { client } = await requireSession();
  return await client
    .from("archives")
    .select("*")
    .order("created_at")
    .retry(false)
    .abortSignal(AbortSignal.timeout(5000));
});
const readMemberships = cache(async (archiveId: string) => {
  const { client } = await requireSession();
  return await client
    .from("archive_memberships")
    .select("*, profiles(display_name,email)")
    .eq("archive_id", archiveId)
    .retry(false)
    .abortSignal(AbortSignal.timeout(2500));
});
export function loadWorkspace(
  options: {
    archiveId?: string;
    batchId?: string;
    catalogue?: boolean;
    archived?: boolean;
    shell?: boolean;
    materialOnly?: boolean;
  } = {},
): Promise<LiveSnapshot | null> {
  return cachedWorkspace(
    options.archiveId,
    options.batchId,
    options.catalogue !== false,
    !!options.archived,
    !!options.shell,
    !!options.materialOnly,
  );
}
const cachedWorkspace = cache(
  async (
    archiveId: string | undefined,
    requestedBatch: string | undefined,
    catalogue: boolean,
    archived: boolean,
    shell: boolean,
    materialOnly: boolean,
  ): Promise<LiveSnapshot | null> => {
    const options = { archiveId, batchId: requestedBatch, catalogue, archived };
    const { client, user } = await requireSession();
    const { data: ars, error: arError } = await readArchives();
    if (arError)
      throw new BackendError(
        503,
        "The database foundation is not ready, or the archive could not be reached. Apply the migrations in docs/supabase-setup.md, then try again.",
      );
    if (!ars?.length) return null;
    let requestedArchive = options.archiveId;
    let batchLookupError = false;
    if (options.batchId && !requestedArchive) {
      const { data, error } = await client
        .from("import_batches")
        .select("archive_id")
        .eq("id", options.batchId)
        .retry(false)
        .abortSignal(AbortSignal.timeout(2500))
        .maybeSingle();
      if (error) batchLookupError = true;
      else if (!data) return null;
      else requestedArchive = data.archive_id;
    }
    const selected = (await cookies()).get("active_archive")?.value;
    const row = requestedArchive
      ? ars.find((a) => a.id === requestedArchive)
      : ars.find((a) => a.id === selected) || ars[0];
    if (!row) return null;
    const batchId = options.batchId;
    const warnings: string[] = [];
    const optional = async <T>(
      task: PromiseLike<{ data: T[] | null; error: unknown }> & {
        retry?: (enabled: boolean) => unknown;
        abortSignal?: (signal: AbortSignal) => unknown;
      },
      label: string,
    ) => {
      try {
        task.retry?.(false);
        task.abortSignal?.(AbortSignal.timeout(2500));
        const result = await task;
        if (result.error) throw result.error;
        return { data: result.data || [] };
      } catch {
        warnings.push(label);
        return { data: [] as T[] };
      }
    };
    let available = true,
      catalogueCount: number | null = null;
    const results = await Promise.all([
      optional(readMemberships(row.id), "Member details could not load."),
      options.catalogue === false
        ? Promise.resolve({ data: [] })
        : (batchLookupError
            ? Promise.reject(new Error("batch unavailable"))
            : readCatalogue(client, row.id, batchId, options.archived)
          )
            .then((result) => {
              catalogueCount = result.count;
              return { data: result.data };
            })
            .catch(() => {
              available = false;
              warnings.push(
                "The archive list could not load completely. Please retry.",
              );
              return { data: [] };
            }),
      options.catalogue === false
        ? Promise.resolve({ data: [] as OriginalRow[] })
        : allRows<OriginalRow>(
            (from, to) =>
              client
                .from("archive_item_files")
                .select("id,item_id,purpose,status,page_order", {
                  count: "exact",
                })
                .eq("archive_id", row.id)
                .eq("purpose", "original")
                .eq("status", "stored")
                .order("id")
                .range(from, to)
                .retry(false)
                .abortSignal(AbortSignal.timeout(2500)),
            (f) => f.id,
          ).catch(() => {
            warnings.push(
              "Some source previews could not load. Items remain available.",
            );
            return { data: [] as OriginalRow[] };
          }),
      shell
        ? Promise.resolve({ data: [] as PersonRow[] })
        : allRows<PersonRow>(
            (from, to) =>
              client
                .from("people")
                .select("*", { count: "exact" })
                .eq("archive_id", row.id)
                .order("display_name")
                .order("id")
                .range(from, to)
                .retry(false)
                .abortSignal(AbortSignal.timeout(2500)),
            (p) => p.id,
          ).catch(() => {
            warnings.push("People could not load.");
            return { data: [] };
          }),
      shell || materialOnly
        ? Promise.resolve({ data: [] })
        : optional(
            client
              .from("activity_log")
              .select("*")
              .eq("archive_id", row.id)
              .order("created_at", { ascending: false })
              .limit(100),
            "Activity could not load.",
          ),
      shell || materialOnly
        ? Promise.resolve({ data: [] })
        : optional(
            client
              .from("processing_jobs")
              .select("*")
              .eq("archive_id", row.id)
              .order("created_at", { ascending: false })
              .limit(100),
            "Processing information could not load.",
          ),
      shell
        ? Promise.resolve({ data: [] })
        : optional(
            client
              .from("import_batch_items")
              .select("batch_id,item_id")
              .eq("archive_id", row.id)
              .order("created_at", { ascending: false }),
            "Import grouping is unavailable.",
          ),
      options.catalogue === false
        ? Promise.resolve({ data: [] as ImageSetRow[] })
        : allRows<ImageSetRow>(
            (from, to) =>
              client
                .from("current_image_sets")
                .select("*", { count: "exact" })
                .eq("archive_id", row.id)
                .eq("status", "stored")
                .order("id")
                .range(from, to)
                .retry(false)
                .abortSignal(AbortSignal.timeout(2500)),
            (row) => row.id,
          ).catch(() => ({ data: [] as ImageSetRow[] })),
      options.catalogue === false
        ? Promise.resolve({ data: [] as PersonLink[], available: true })
        : allRows<PersonLink>(
            (from, to) =>
              client
                .from("identifications")
                .select("id,archive_id,item_id,person_id,status", {
                  count: "exact",
                })
                .eq("archive_id", row.id)
                .in("status", ["reported", "accepted"])
                .order("id")
                .range(from, to)
                .retry(false)
                .abortSignal(AbortSignal.timeout(2500)),
            (i) => i.id,
          )
            .then((value) => ({ ...value, available: true }))
            .catch(() => {
              warnings.push(
                "Person associations could not load. Reload before filtering by People.",
              );
              return { data: [] as PersonLink[], available: false };
            }),
      options.catalogue === false
        ? Promise.resolve({ data: [] as { id: string; item_id: string }[] })
        : allRows<{ id: string; item_id: string }>(
            (from, to) => client.from("recollections").select("id,item_id", { count: "exact" })
              .eq("archive_id", row.id).order("id").range(from, to).retry(false)
              .abortSignal(AbortSignal.timeout(2500)), r => r.id,
          ).catch(() => {
            warnings.push("Some recollection context could not load.");
            return { data: [] as { id: string; item_id: string }[] };
          }),
    ]);
    const members: Member[] = (results[0].data || []).map((m) => ({
      archiveId: m.archive_id,
      id: m.id,
      profileId: m.profile_id,
      name: m.profiles?.display_name || "Archive member",
      email: m.profiles?.email || "",
      role: m.role,
      status: m.status,
      linkedPersonId: m.linked_person_id,
      joinedAt: m.joined_at.slice(0, 10),
      lastActive: "Not tracked",
    }));
    const archives: Archive[] = ars.map((a) => ({
      id: a.id,
      name: a.name,
      slug: a.slug,
      description: a.description,
      coverImage: a.cover_file_id
        ? `/api/v1/assets/${a.cover_file_id}?variant=thumbnail`
        : "/images/empty-archive.svg",
      ownerMembershipId: a.owner_membership_id,
      createdAt: a.created_at,
      privacy: a.privacy,
      settings: {
        defaultRole: a.settings.defaultRole || "contributor",
        ai: false,
        transcription: false,
        locations: false,
        invitations: false,
      },
    }));
    const catalogueItemsResult = catalogueItems(
      results[1].data,
      results[2].data,
      results[6].data,
      batchId,
      results[7].data,
    );
    const peopleByItem = new Map<string, Set<string>>();
    for (const link of results[8].data)
      if (link.person_id) {
        const ids = peopleByItem.get(link.item_id) || new Set<string>();
        ids.add(link.person_id);
        peopleByItem.set(link.item_id, ids);
      }
    catalogueItemsResult.forEach((item) => {
      item.people = [...(peopleByItem.get(item.id) || [])];
    });
    const people: Person[] = (results[3].data || []).map((p) => ({
      archiveId: p.archive_id,
      id: p.id,
      slug: p.slug,
      name: p.display_name,
      lifespan: p.lifespan || "Dates not yet known",
      category: (
        {
          family: "Family",
          friend: "Friends",
          other: "Other",
          unidentified: "Unidentified",
        } as const
      )[p.category as "family" | "friend" | "other" | "unidentified"],
      image: p.portrait_file_id
        ? `/api/v1/assets/${p.portrait_file_id}?variant=thumbnail`
        : "/images/empty-archive.svg",
      bio: p.biography,
    }));
    const recollected = new Set(results[9].data.map(r => r.item_id));
    const personNames = new Map(people.map(p => [p.id, p.name]));
    catalogueItemsResult.forEach(item => {
      item.hasRecollection = recollected.has(item.id);
      const display = cataloguePresentation({kind: item.kind, title: item.rawTitle, datePrecision: item.datePrecision,
        people: item.people.map(id => personNames.get(id) || "Person linked"),
        date: item.date === "Date not yet known" ? "" : item.date,
        place: item.place === "Place not yet known" ? "" : item.place,
        notes: item.notes || item.reportedPeople, hasRecollection: item.hasRecollection,
        catalogued: item.collection === "Catalogued"});
      Object.assign(item, display, {alt: display.title, collection: display.catalogueState === "Not yet catalogued" ? "Uncatalogued" : display.catalogueState});
    });
    return {
      identifications: results[8].data,
      peopleLinksAvailable: results[8].available,
      catalogueBatchId: batchId,
      catalogueLoaded: options.catalogue !== false,
      catalogueAvailable: available,
      catalogueCount,
      resourceWarnings: warnings,
      profileId: user.id,
      profileName:
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "Archive member",
      profileEmail: user.email || "",
      archive: archives.find((a) => a.id === row.id)!,
      archives,
      members,
      catalogue: catalogueItemsResult,
      people,
      activity: (results[4].data || []).map((a) => ({
        archiveId: a.archive_id,
        id: a.id,
        actor: a.actor_id === user.id ? "You" : "Archive member",
        action: a.summary,
        at: a.created_at,
        layer: a.event_type.includes("membership") ? "access" : "source",
        itemId: a.item_id,
      })),
      jobs: (results[5].data || []).map((j) => ({
        archiveId: j.archive_id,
        id: j.id,
        title:
          catalogueItemsResult.find((i) => i.id === j.item_id)?.title ||
          "Archive item",
        kind: "Source material",
        status: j.status,
        stage: j.stage,
        href: `/archive/${j.item_id}`,
      })),
    };
  },
);
export async function requireArchiveRole(
  archiveId: string,
  minimum: MemberRole = "viewer",
) {
  const { client, user } = await requireSession();
  const { data, error } = await client.rpc("can_access_archive", {
    p_archive_id: archiveId,
    p_minimum: minimum,
  });
  if (error)
    throw new BackendError(
      503,
      "Archive permissions could not be checked. Apply the migrations or try again.",
    );
  if (!data)
    throw new BackendError(
      403,
      "You do not have permission to do that in this archive.",
    );
  return { client, user };
}
export async function loadItem(id: string) {
  const { client } = await requireSession();
  const { data: item, error } = await client
    .from("archive_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error)
    throw new BackendError(503, "The item could not be loaded. Please retry.");
  if (!item) return null;
  const snapshot = await loadWorkspace({
    archiveId: item.archive_id,
    catalogue: false,
  });
  if (!snapshot) return null;
  const [files, recollections, comments, identifications, sets] =
    await Promise.all([
      client
        .from("archive_item_files")
        .select("*")
        .eq("archive_id", snapshot.archive.id)
        .eq("item_id", id)
        .eq("status", "stored")
        .order("page_order")
        .retry(false)
        .abortSignal(AbortSignal.timeout(2500)),
      client
        .from("recollections")
        .select("*")
        .eq("archive_id", snapshot.archive.id)
        .eq("item_id", id)
        .order("created_at")
        .retry(false)
        .abortSignal(AbortSignal.timeout(2500)),
      client
        .from("comments")
        .select("*")
        .eq("archive_id", snapshot.archive.id)
        .eq("item_id", id)
        .order("created_at")
        .retry(false)
        .abortSignal(AbortSignal.timeout(2500)),
      client
        .from("identifications")
        .select("*")
        .eq("archive_id", snapshot.archive.id)
        .eq("item_id", id)
        .order("created_at")
        .retry(false)
        .abortSignal(AbortSignal.timeout(2500)),
      client
        .from("current_image_sets")
        .select("*")
        .eq("item_id", id)
        .eq("status", "stored")
        .order("created_at", { ascending: false })
        .retry(false)
        .abortSignal(AbortSignal.timeout(2500)),
    ]);
  return {
    resourceWarnings: [
      files.error,
      recollections.error,
      comments.error,
      identifications.error,
    ].filter(Boolean),
    imageSets: (sets.data || []).map((row) => imageSet(row as ImageSetRow)),
    snapshot,
    item,
    files: files.data || [],
    recollections: recollections.data || [],
    comments: comments.data || [],
    identifications: identifications.data || [],
  };
}
