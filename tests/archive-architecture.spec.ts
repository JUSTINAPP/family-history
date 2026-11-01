import { test, expect } from "@playwright/test";
import {
  initialArchive,
  initialMembers,
  demoProfileId,
} from "../src/lib/demo-workspace";
import {
  accessibleArchives,
  archiveMembership,
  validateArchiveUpdate,
} from "../src/lib/archives";
import type { Archive, Member } from "../src/lib/workspace-types";

test("one account has independent roles and ownership across archives", () => {
  const wedding: Archive = {
    ...initialArchive,
    id: "a0000000-0000-4000-8000-000000000002",
    name: "Our Wedding",
    slug: "our-wedding",
    ownerMembershipId: "d1000000-0000-4000-8000-000000000006",
  };
  const another: Archive = {
    ...initialArchive,
    id: "a0000000-0000-4000-8000-000000000003",
    name: "Another Family Archive",
    slug: "another-family-archive",
    ownerMembershipId: "d1000000-0000-4000-8000-000000000008",
  };
  const weddingMembership: Member = {
    ...initialMembers[0],
    archiveId: wedding.id,
    id: wedding.ownerMembershipId,
  };
  const viewerMembership: Member = {
    ...initialMembers[0],
    archiveId: another.id,
    id: "d1000000-0000-4000-8000-000000000007",
    role: "viewer",
  };
  const members = [...initialMembers, weddingMembership, viewerMembership];
  expect(archiveMembership(initialArchive, members, demoProfileId)?.role).toBe(
    "admin",
  );
  expect(archiveMembership(wedding, members, demoProfileId)?.role).toBe(
    "admin",
  );
  expect(archiveMembership(another, members, demoProfileId)?.role).toBe(
    "viewer",
  );
  expect(
    accessibleArchives(
      [initialArchive, wedding, another],
      members,
      demoProfileId,
    ),
  ).toHaveLength(3);
  expect(
    accessibleArchives(
      [{ ...another, privacy: "owner_only" }],
      members,
      demoProfileId,
    ),
  ).toEqual([]);
  expect(
    accessibleArchives(
      [wedding],
      members.map((m) =>
        m.id === weddingMembership.id
          ? { ...m, status: "suspended" as const }
          : m,
      ),
      demoProfileId,
    ),
  ).toEqual([]);
  expect(
    validateArchiveUpdate(
      initialArchive,
      { ...initialArchive, ownerMembershipId: weddingMembership.id },
      [initialArchive, wedding],
      members,
    ),
  ).toContain("in this archive");
  expect(
    validateArchiveUpdate(
      initialArchive,
      { ...initialArchive, slug: wedding.slug },
      [initialArchive, wedding],
      members,
    ),
  ).toContain("already in use");
});

test("current archive is quiet, named and accessible from the switcher", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".archive-current-name")).toHaveText(
    "Allen & Cork",
  );
  await expect(page).toHaveTitle(/The Allen & Cork Archive/);
  await page.locator(".archive-switcher summary").click();
  await expect(page.locator(".archive-switcher-panel li")).toHaveCount(1);
  await expect(page.locator(".archive-switcher-panel")).toContainText(
    "Admin · current archive",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".archive-switcher")).not.toHaveAttribute("open");
  await page.locator(".archive-switcher summary").click();
  await page
    .locator(".archive-switcher-panel")
    .getByRole("link", { name: "Archive settings", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Archive name", exact: true }),
  ).toHaveValue("The Allen & Cork Archive");
  await expect(
    page.getByRole("textbox", { name: "Archive slug", exact: true }),
  ).toHaveValue("the-allen-and-cork-archive");
  await expect(
    page.getByText("Created 12 September 2026", { exact: false }),
  ).toBeVisible();
});

test("archive identity, private access and default permissions are editable without changing existing roles", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await page
    .getByRole("textbox", { name: "Archive name", exact: true })
    .fill("Kodaikanal Years");
  await page
    .getByRole("textbox", { name: "Description", exact: true })
    .fill("Photographs, letters and places from our years in Kodaikanal.");
  await page
    .getByRole("combobox", { name: "Cover image", exact: true })
    .selectOption("/images/picnic.jpg");
  await page
    .getByRole("combobox", { name: "Privacy", exact: true })
    .selectOption("owner_only");
  await page
    .getByRole("combobox", {
      name: "Default permissions for new members",
      exact: true,
    })
    .selectOption("viewer");
  await page.getByRole("button", { name: "Save archive settings" }).click();
  await expect(
    page.getByText("Settings saved in this demo session.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".archive-current-name")).toHaveText(
    "Kodaikanal Years",
  );
  await expect(
    page.getByRole("textbox", { name: "Archive slug", exact: true }),
  ).toHaveValue("the-allen-and-cork-archive");
  await page.getByRole("link", { name: "Manage archive members" }).click();
  await expect(
    page.locator(".member-row").filter({ hasText: "Sarah Allen" }),
  ).toContainText("Editor");
  await expect(
    page.locator(".member-row").filter({ hasText: "Jonas Allen" }),
  ).toContainText("Admin");
  await page.getByRole("button", { name: "Invite member" }).click();
  await expect(
    page.getByRole("dialog").getByRole("radio", { name: /Viewer/ }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Archive settings", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Privacy", exact: true }),
  ).toHaveValue("owner_only");
  await expect(
    page.getByRole("combobox", { name: "Cover image", exact: true }),
  ).toHaveValue("/images/picnic.jpg");
  await page
    .getByRole("combobox", { name: "Privacy", exact: true })
    .selectOption("members_only");
  await page.getByRole("button", { name: "Save archive settings" }).click();
  await expect(
    page.getByRole("combobox", { name: "Privacy", exact: true }),
  ).toHaveValue("members_only");
});
