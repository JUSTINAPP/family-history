import type { MemberRole } from "./types";
export const roleOrder: MemberRole[] = [
  "viewer",
  "commenter",
  "contributor",
  "editor",
  "admin",
];
export const roleDetails: Record<
  MemberRole,
  { title: string; summary: string; abilities: string[] }
> = {
  viewer: {
    title: "Viewer",
    summary: "A way into the collection.",
    abilities: ["Browse, search, view people, places, stories and the tree"],
  },
  commenter: {
    title: "Commenter",
    summary: "Share what you remember.",
    abilities: [
      "Everything a Viewer can do",
      "Comment, suggest identities and add family recollections",
    ],
  },
  contributor: {
    title: "Contributor",
    summary: "Bring more of the story.",
    abilities: [
      "Everything a Commenter can do",
      "Capture and upload material, add voice recollections and describe own contributions",
    ],
  },
  editor: {
    title: "Editor",
    summary: "Care for the historical record.",
    abilities: [
      "Everything a Contributor can do",
      "Edit metadata, verify identities, review transcriptions and AI suggestions",
      "Manage people, relationships, collections and stories",
    ],
  },
  admin: {
    title: "Admin",
    summary: "Look after the archive and its members.",
    abilities: [
      "Everything an Editor can do",
      "Invite, suspend and remove members; change roles",
      "Manage settings, integrations, processing and archive configuration",
    ],
  },
};
export function can(role: MemberRole, minimum: MemberRole) {
  return roleOrder.indexOf(role) >= roleOrder.indexOf(minimum);
}
