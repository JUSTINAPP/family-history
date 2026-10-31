"use client";
import {
  createContext,
  Fragment,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  accessibleArchives,
  archiveMembership,
  validateArchiveUpdate,
} from "@/lib/archives";
import {
  demoProfileId,
  initialActivity,
  initialInvitations,
  initialMembers,
  initialArchive,
  initialJobs,
  processingStages,
} from "@/lib/demo-workspace";
import type { MemberRole } from "@/lib/types";
import type {
  Activity,
  Archive,
  ArchiveSettings,
  CapturedItem,
  Invitation,
  Member,
  ReviewJob,
} from "@/lib/workspace-types";
import { can } from "@/lib/permissions";
export type NewCapture = Omit<
  CapturedItem,
  "id" | "archiveId" | "createdAt" | "contributorId" | "jobStatus" | "jobStep"
>;
export interface Workspace {
  mode: "demo" | "live";
  profileId: string;
  profileName: string;
  profileEmail: string;
  catalogueAvailable?: boolean;
  catalogueCount?: number | null;
  resourceWarnings?: string[];
  catalogue: import("@/lib/types").ArchiveItem[];
  historicalPeople: import("@/lib/types").Person[];
  capturedCount: number;
  archive: Archive;
  archives: Archive[];
  selectArchive: (id: string) => boolean | Promise<boolean>;
  saveArchive: (value: Archive) => string | null | Promise<string | null>;
  role: MemberRole;
  setRole: (role: MemberRole) => void;
  captures: CapturedItem[];
  saveCapture: (item: NewCapture) => string | Promise<string>;
  registerUrl: (url: string) => void;
  members: Member[];
  updateMember: (
    id: string,
    patch: Partial<Pick<Member, "role" | "linkedPersonId" | "status">>,
  ) => string | null | Promise<string | null>;
  invitations: Invitation[];
  invite: (
    input: Pick<Invitation, "name" | "email" | "role" | "linkedPersonId">,
  ) => string | null | Promise<string | null>;
  updateInvitation: (
    id: string,
    action: "revoke" | "resend" | "accept",
  ) => void;
  settings: ArchiveSettings;
  activity: Activity[];
  log: (action: string, layer: Activity["layer"], itemId?: string) => void;
  jobs: ReviewJob[];
  retryJob: (id: string) => void;
  finishReview: (id: string) => void;
  reviewedText: Record<string, string>;
  saveReview: (id: string, text: string) => void;
}
export const WorkspaceContext = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [archiveRecords, setArchiveRecords] = useState<Archive[]>([
    initialArchive,
  ]);
  const [activeArchiveId, setActiveArchiveId] = useState(initialArchive.id);
  const [rolePreviews, setRolePreviews] = useState<Record<string, MemberRole>>(
    {},
  );
  const archive = archiveRecords.find((a) => a.id === activeArchiveId)!;
  const archiveId = archive.id;
  const settings = archive.settings;
  const [allCaptures, setCaptures] = useState<CapturedItem[]>([]);
  const [allMembers, setMembers] = useState(initialMembers);
  const [allInvitations, setInvitations] = useState(initialInvitations);
  const [allActivity, setActivity] = useState(initialActivity);
  const [allJobs, setJobs] = useState(initialJobs);
  const [reviewedByArchive, setReviewedByArchive] = useState<
    Record<string, Record<string, string>>
  >({});
  const reviewedText = reviewedByArchive[archiveId] || {};
  const members = allMembers.filter((m) => m.archiveId === archiveId);
  const invitations = allInvitations.filter((i) => i.archiveId === archiveId);
  const captures = allCaptures.filter((i) => i.archiveId === archiveId);
  const activity = allActivity.filter((a) => a.archiveId === archiveId);
  const jobs = allJobs.filter((j) => j.archiveId === archiveId);
  const membership = archiveMembership(archive, allMembers, demoProfileId);
  const role = rolePreviews[archiveId] || membership?.role || "viewer";
  function setRole(value: MemberRole) {
    setRolePreviews((old) => ({ ...old, [archiveId]: value }));
  }
  function selectArchive(id: string) {
    if (
      !accessibleArchives(archiveRecords, allMembers, demoProfileId).some(
        (a) => a.id === id,
      )
    )
      return false;
    setActiveArchiveId(id);
    return true;
  }
  function saveArchive(value: Archive) {
    if (role !== "admin") return "Admin access is required.";
    const error = validateArchiveUpdate(
      archive,
      value,
      archiveRecords,
      allMembers,
    );
    if (error) return error;
    setArchiveRecords((old) =>
      old.map((a) =>
        a.id === archiveId
          ? {
              ...value,
              name: value.name.trim(),
              description: value.description.trim(),
              id: a.id,
              createdAt: a.createdAt,
            }
          : a,
      ),
    );
    log(
      "updated this archive’s identity and settings in the demo session.",
      "access",
    );
    return null;
  }
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
    [],
  );
  useEffect(() => {
    const timer = setInterval(
      () =>
        setCaptures((old) =>
          old.map((item) => {
            if (
              item.jobStatus === "complete" ||
              item.jobStatus === "needs_review" ||
              item.jobStatus === "failed"
            )
              return item;
            if (item.jobStatus === "queued")
              return { ...item, jobStatus: "processing" };
            const stages = processingStages(item.kind);
            const next = item.jobStep + 1;
            return {
              ...item,
              jobStep: Math.min(next, stages.length - 1),
              jobStatus:
                next >= stages.length
                  ? item.kind === "Letter"
                    ? "needs_review"
                    : "complete"
                  : "processing",
            };
          }),
        ),
      1800,
    );
    return () => clearInterval(timer);
  }, []);
  function log(action: string, layer: Activity["layer"], itemId?: string) {
    setActivity((old) => [
      {
        id: crypto.randomUUID(),
        archiveId,
        actor: "Jonas (demo)",
        action,
        at: new Date().toISOString(),
        layer,
        itemId,
      },
      ...old,
    ]);
  }
  function saveCapture(input: NewCapture) {
    if (!can(role, "contributor")) return "";
    const id = crypto.randomUUID();
    setCaptures((old) => [
      {
        ...input,
        id,
        archiveId,
        contributorId: demoProfileId,
        createdAt: new Date().toISOString(),
        jobStatus: "queued",
        jobStep: 0,
      },
      ...old,
    ]);
    log(
      `captured ${input.kind.toLowerCase()}: ${input.title}. Original files and recollection kept separately in this session.`,
      "source",
      id,
    );
    return id;
  }
  function updateMember(
    id: string,
    patch: Partial<Pick<Member, "role" | "linkedPersonId" | "status">>,
  ) {
    if (role !== "admin") return "Admin access is required.";
    const member = members.find((m) => m.id === id);
    if (!member) return "Member not found.";
    const owner = members.find((m) => m.id === archive.ownerMembershipId);
    if (
      id === owner?.id &&
      ((patch.role && patch.role !== "admin") ||
        (patch.status && patch.status !== "active"))
    )
      return "Transfer archive ownership before changing the owner’s access.";
    if (
      member.role === "admin" &&
      member.status === "active" &&
      ((patch.role && patch.role !== "admin") ||
        (patch.status && patch.status !== "active")) &&
      members.filter((m) => m.role === "admin" && m.status === "active")
        .length <= 1
    )
      return "Keep at least one active admin.";
    setMembers((old) =>
      old.map((m) =>
        m.archiveId === archiveId && m.id === id ? { ...m, ...patch } : m,
      ),
    );
    log(
      `updated ${member.name}’s archive membership. Historical contributions were retained.`,
      "access",
    );
    return null;
  }
  function invite(
    input: Pick<Invitation, "name" | "email" | "role" | "linkedPersonId">,
  ) {
    if (role !== "admin") return "Admin access is required.";
    if (!settings.invitations)
      return "Member invitations are paused in archive settings.";
    const email = input.email.trim().toLowerCase();
    if (
      members.some(
        (m) => m.email.toLowerCase() === email && m.status !== "removed",
      ) ||
      invitations.some(
        (i) => i.email.toLowerCase() === email && i.status === "invited",
      )
    )
      return "This email already has access or a pending invitation.";
    const at = new Date();
    setInvitations((old) => [
      {
        ...input,
        archiveId,
        email,
        id: crypto.randomUUID(),
        status: "invited",
        invitedAt: at.toISOString(),
        expiresAt: new Date(at.getTime() + 7 * 86400000).toISOString(),
      },
      ...old,
    ]);
    log(
      `created a demo ${input.role} invitation for ${input.name}. No email was sent.`,
      "access",
    );
    return null;
  }
  function updateInvitation(
    id: string,
    action: "revoke" | "resend" | "accept",
  ) {
    if (role !== "admin") return;
    const item = invitations.find((i) => i.id === id);
    if (!item) return;
    if (action === "accept" && item.status !== "invited") return;
    if (action === "resend" && !settings.invitations) return;
    setInvitations((old) =>
      old.map((i) =>
        i.archiveId === archiveId && i.id === id
          ? {
              ...i,
              status:
                action === "revoke"
                  ? "revoked"
                  : action === "accept"
                    ? "accepted"
                    : "invited",
              ...(action === "resend"
                ? {
                    invitedAt: new Date().toISOString(),
                    expiresAt: new Date(
                      Date.now() + 7 * 86400000,
                    ).toISOString(),
                  }
                : {}),
            }
          : i,
      ),
    );
    if (action === "accept") {
      setMembers((old) => {
        const existing = old.find(
          (m) =>
            m.archiveId === archiveId &&
            m.email.toLowerCase() === item.email.toLowerCase(),
        );
        if (existing)
          return old.map((m) =>
            m.archiveId === archiveId && m.id === existing.id
              ? {
                  ...m,
                  role: item.role,
                  linkedPersonId: item.linkedPersonId,
                  status: "active",
                  lastActive: "Demo acceptance",
                }
              : m,
          );
        return [
          ...old,
          {
            archiveId,
            id: crypto.randomUUID(),
            profileId: crypto.randomUUID(),
            name: item.name,
            email: item.email,
            role: item.role,
            linkedPersonId: item.linkedPersonId,
            status: "active",
            lastActive: "Demo acceptance",
            joinedAt: new Date().toISOString().slice(0, 10),
          },
        ];
      });
    }
    log(
      `${action === "accept" ? "simulated acceptance of" : action === "revoke" ? "revoked" : "renewed"} ${item.name}’s invitation. No email or authentication service used.`,
      "access",
    );
  }
  function retryJob(id: string) {
    if (!can(role, "editor")) return;
    setJobs((old) =>
      old.map((j) =>
        j.archiveId === archiveId && j.id === id
          ? {
              ...j,
              status: "queued",
              stage: "Retry queued · demo",
              error: undefined,
            }
          : j,
      ),
    );
    log(
      "queued a derivative retry. The preserved original is unchanged.",
      "source",
    );
  }
  function finishReview(id: string) {
    if (!can(role, "editor")) return;
    setCaptures((old) =>
      old.map((i) =>
        i.archiveId === archiveId && i.id === id
          ? { ...i, jobStatus: "complete" }
          : i,
      ),
    );
    setJobs((old) =>
      old.map((j) =>
        j.archiveId === archiveId && j.id === id
          ? { ...j, status: "complete", stage: "Reviewed in this session" }
          : j,
      ),
    );
  }
  function saveReview(id: string, text: string) {
    if (!can(role, "editor")) return;
    setReviewedByArchive((old) => ({
      ...old,
      [archiveId]: { ...old[archiveId], [id]: text },
    }));
    finishReview(id);
    log(
      "saved a reviewed transcription; raw AI sample and original scans retained.",
      "review",
      id,
    );
  }
  return (
    <WorkspaceContext.Provider
      value={{
        mode: "demo",
        profileId: demoProfileId,
        profileName: "Jonas Allen",
        profileEmail: "jonas@example.test",
        catalogue: [],
        historicalPeople: [],
        capturedCount: captures.length,
        archive,
        archives: accessibleArchives(archiveRecords, allMembers, demoProfileId),
        selectArchive,
        saveArchive,
        role,
        setRole,
        captures,
        saveCapture,
        registerUrl: (url) => urls.current.push(url),
        members,
        updateMember,
        invitations,
        invite,
        updateInvitation,
        settings,
        activity,
        log,
        jobs,
        retryJob,
        finishReview,
        reviewedText,
        saveReview,
      }}
    >
      <Fragment key={archiveId}>{children}</Fragment>
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("WorkspaceProvider is required");
  return value;
}
