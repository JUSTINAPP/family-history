import "server-only";
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
export interface LiveSnapshot {
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
export async function requireSession() {
  const auth = await authenticatedClient();
  if (!auth)
    throw new BackendError(
      401,
      "Your session has expired. Sign in again; your selected files are still on this page.",
    );
  return auth;
}
export async function loadWorkspace(): Promise<LiveSnapshot | null> {
  const { client, user } = await requireSession();
  const { data: ars, error: arError } = await client
    .from("archives")
    .select("*")
    .order("created_at");
  if (arError)
    throw new BackendError(
      503,
      "The database foundation is not ready, or the archive could not be reached. Apply the migrations in docs/supabase-setup.md, then try again.",
    );
  if (!ars?.length) return null;
  const selected = (await cookies()).get("active_archive")?.value;
  const row = ars.find((a) => a.id === selected) || ars[0];
  const results = await Promise.all([
    client
      .from("archive_memberships")
      .select("*, profiles(display_name,email)")
      .eq("archive_id", row.id),
    client
      .from("archive_items")
      .select("*")
      .eq("archive_id", row.id)
      .eq("ingestion_status", "ready")
      .order("created_at", { ascending: false }),
    client
      .from("archive_item_files")
      .select("*")
      .eq("archive_id", row.id)
      .eq("status", "stored")
      .order("page_order"),
    client
      .from("people")
      .select("*")
      .eq("archive_id", row.id)
      .order("display_name"),
    client
      .from("activity_log")
      .select("*")
      .eq("archive_id", row.id)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("processing_jobs")
      .select("*")
      .eq("archive_id", row.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (results.some((r) => r.error))
    throw new BackendError(
      503,
      "The archive could not finish loading. Please try again.",
    );
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
      ? `/api/v1/files/${a.cover_file_id}`
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
  const files = results[2].data || [];
  const catalogue: ArchiveItem[] = (results[1].data || []).map((i) => ({
    archiveId: i.archive_id,
    id: i.id,
    slug: i.id,
    title: i.title,
    kind: i.kind,
    date: i.reported_date || "Date not yet known",
    place: i.reported_place || "Place not yet known",
    people: [],
    reportedPeople: i.people_text,
    collection: i.catalogued_at ? "Catalogued" : "Uncatalogued",
    image: files.find((f) => f.item_id === i.id)
      ? `/api/v1/previews/${files.find((f) => f.item_id === i.id && f.purpose === "original")?.id || files.find((f) => f.item_id === i.id)!.id}`
      : "/images/empty-archive.svg",
    alt: i.title,
    aspect: i.kind === "Letter" ? "portrait" : "landscape",
    certainty: i.evidence_status,
    year: /^(18|19|20)\d{2}(?:-\d{2}-\d{2})?$/.test(i.reported_date)
      ? Number(i.reported_date.slice(0, 4))
      : undefined,
    notes: i.notes,
    tags: [],
  }));
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
      ? `/api/v1/files/${p.portrait_file_id}`
      : "/images/empty-archive.svg",
    bio: p.biography,
  }));
  return {
    profileId: user.id,
    profileName:
      user.user_metadata?.display_name ||
      user.email?.split("@")[0] ||
      "Archive member",
    profileEmail: user.email || "",
    archive: archives.find((a) => a.id === row.id)!,
    archives,
    members,
    catalogue,
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
      title: catalogue.find((i) => i.id === j.item_id)?.title || "Archive item",
      kind: "Source material",
      status: j.status,
      stage: j.stage,
      href: `/archive/${j.item_id}`,
    })),
  };
}
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
  const snapshot = await loadWorkspace();
  if (!snapshot) return null;
  const { client } = await requireSession();
  const { data: item, error } = await client
    .from("archive_items")
    .select("*")
    .eq("archive_id", snapshot.archive.id)
    .eq("id", id)
    .eq("ingestion_status", "ready")
    .maybeSingle();
  if (error || !item) return null;
  const [files, recollections, comments, identifications] = await Promise.all([
    client
      .from("archive_item_files")
      .select("*")
      .eq("archive_id", snapshot.archive.id)
      .eq("item_id", id)
      .eq("status", "stored")
      .order("page_order"),
    client
      .from("recollections")
      .select("*")
      .eq("archive_id", snapshot.archive.id)
      .eq("item_id", id)
      .order("created_at"),
    client
      .from("comments")
      .select("*")
      .eq("archive_id", snapshot.archive.id)
      .eq("item_id", id)
      .order("created_at"),
    client
      .from("identifications")
      .select("*")
      .eq("archive_id", snapshot.archive.id)
      .eq("item_id", id)
      .order("created_at"),
  ]);
  return {
    snapshot,
    item,
    files: files.data || [],
    recollections: recollections.data || [],
    comments: comments.data || [],
    identifications: identifications.data || [],
  };
}
