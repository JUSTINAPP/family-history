import type { ItemKind, MemberRole, UUID } from "./types";
export type JobStatus =
  "queued" | "processing" | "needs_review" | "complete" | "failed";
export type CaptureKind = ItemKind | "Postcard" | "Certificate" | "Artwork";
export interface SourceFile {
  id: UUID;
  file: File;
  url: string;
  role: string;
  originalName: string;
}
export interface Recollection {
  id: UUID;
  contributorId: UUID;
  recordedAt: string;
  originalText: string;
  audioSource?: string;
  audioOriginalName?: string;
  machineTranscript: string;
  editedTranscript: string | null;
}
export interface Suggestion {
  id: UUID;
  field: "People" | "When" | "Where" | "Type";
  value: string;
  originalValue: string;
  status: "suggested" | "uncertain" | "confirmed" | "removed";
  origin: "demo_interpretation";
}
export interface CapturedItem {
  id: UUID;
  archiveId: UUID;
  kind: CaptureKind;
  title: string;
  createdAt: string;
  contributorId: UUID;
  files: SourceFile[];
  recollection: Recollection;
  quick: Record<string, string>;
  suggestions: Suggestion[];
  jobStatus: JobStatus;
  jobStep: number;
}
export interface Member {
  archiveId: UUID;
  id: UUID;
  profileId: UUID;
  name: string;
  email: string;
  role: MemberRole;
  linkedPersonId: UUID | null;
  status: "active" | "suspended" | "removed";
  lastActive: string;
  joinedAt: string;
}
export interface Invitation {
  archiveId: UUID;
  id: UUID;
  name: string;
  email: string;
  role: MemberRole;
  linkedPersonId: UUID | null;
  status: "invited" | "accepted" | "expired" | "revoked";
  invitedAt: string;
  expiresAt: string;
}
export interface Activity {
  archiveId: UUID;
  id: UUID;
  actor: string;
  action: string;
  at: string;
  layer: "source" | "context" | "suggestion" | "review" | "access";
  itemId?: UUID;
}
export type ArchivePrivacy = "members_only" | "owner_only";
export interface ArchiveSettings {
  defaultRole: "viewer" | "commenter" | "contributor";
  ai: boolean;
  transcription: boolean;
  locations: boolean;
  invitations: boolean;
}
export interface Archive {
  id: UUID;
  name: string;
  slug: string;
  description: string;
  coverImage: string;
  ownerMembershipId: UUID;
  createdAt: string;
  privacy: ArchivePrivacy;
  settings: ArchiveSettings;
}
export interface ReviewJob {
  archiveId: UUID;
  id: UUID;
  title: string;
  kind: string;
  status: JobStatus;
  stage: string;
  href: string;
  error?: string;
}
