export type UUID = string;
export type ItemKind =
  "Photograph" | "Letter" | "Object" | "Document" | "Other" | "Audio";
export type EvidenceStatus =
  "verified" | "family_reported" | "ai_suggested" | "uncertain";
export type MemberRole =
  "viewer" | "commenter" | "contributor" | "editor" | "admin";
export type FileRole =
  "original" | "display" | "thumbnail" | "preview" | "transcription_source";
export type ProcessingStage =
  | "optimising_images"
  | "detecting_pages"
  | "transcribing_handwriting"
  | "finding_dates_places"
  | "identifying_people"
  | "creating_previews";
export interface ArchiveFile {
  archiveId: UUID;
  id: UUID;
  originalFileId?: UUID;
  role: FileRole;
  storagePath: string;
  pageOrder: number;
  label: string;
  mimeType: string;
  checksum?: string;
}
export interface ArchiveItem {
  placeIds?: string[];
  imageSet?: import("./preview/types").ImageSet;
  archivedAt?: string;
  ingestionStatus?: string;
  sourcePreserved?: boolean;
  sourceCount?: number;
  importBatchId?: string;
  href?: string;
  archiveId: UUID;
  id: UUID;
  slug: string;
  title: string;
  kind: ItemKind;
  date: string;
  year?: number;
  place: string;
  people: string[];
  reportedPeople?: string;
  collection: string;
  image: string;
  alt: string;
  aspect: "portrait" | "landscape" | "square";
  certainty: EvidenceStatus;
  notes: string;
  tags: string[];
}
export interface Person {
  archiveId: UUID;
  id: UUID;
  slug: string;
  name: string;
  lifespan: string;
  category: "Family" | "Friends" | "Other" | "Unidentified";
  image: string;
  position?: string;
  bio: string;
}
export interface TranscriptionResult {
  rawText: string;
  confidence: number | null;
  provider: string;
  model: string;
  processedAt: string;
}
export interface TranscriptionProvider {
  name: string;
  transcribe(input: {
    signedSourceUrls: string[];
    language?: string;
    signal?: AbortSignal;
  }): Promise<TranscriptionResult>;
}
export interface CaptureDraft {
  archiveId: UUID;
  id: UUID;
  kind: ItemKind;
  who: string;
  when: string;
  datePrecision: "exact" | "approximate" | "year" | "unknown";
  where: string;
  notes: string;
  author?: string;
  recipient?: string;
  fileNames: string[];
  createdAt: string;
}
