import type { Archive, Member } from "./workspace-types";
/** Membership, never a global profile role, determines access to each archive. */
export function archiveMembership(
  archive: Archive,
  members: Member[],
  profileId: string,
) {
  return members.find(
    (m) =>
      m.archiveId === archive.id &&
      m.profileId === profileId &&
      m.status === "active",
  );
}
export function accessibleArchives(
  archives: Archive[],
  members: Member[],
  profileId: string,
) {
  return archives.filter((archive) => {
    const membership = archiveMembership(archive, members, profileId);
    return (
      !!membership &&
      (archive.privacy === "members_only" ||
        membership.id === archive.ownerMembershipId)
    );
  });
}
export function validateArchiveUpdate(
  current: Archive,
  next: Archive,
  archives: Archive[],
  members: Member[],
): string | null {
  if (next.id !== current.id) return "Archive identity cannot change.";
  if (!next.name.trim()) return "Please give the archive a name.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next.slug) || next.slug.length > 80)
    return "Use a slug with lowercase letters, numbers and single hyphens.";
  if (archives.some((a) => a.id !== current.id && a.slug === next.slug))
    return "That archive slug is already in use.";
  if (
    !members.some(
      (m) =>
        m.archiveId === current.id &&
        m.id === next.ownerMembershipId &&
        m.status === "active" &&
        m.role === "admin",
    )
  )
    return "The archive owner must be an active admin in this archive.";
  if (!["members_only", "owner_only"].includes(next.privacy))
    return "Choose a private access setting.";
  if (
    !["viewer", "commenter", "contributor"].includes(next.settings.defaultRole)
  )
    return "Choose Viewer, Commenter or Contributor as the default invitation permission.";
  return null;
}
