import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs/promises";
const photo = path.resolve("public/images/beach.jpg");
const letter = path.resolve("public/images/letter.jpg");
async function upload(page: import("@playwright/test").Page) {
  await page.goto("/add");
  await page
    .getByLabel("Upload existing images", { exact: true })
    .setInputFiles(photo);
}
for (const width of [375, 768, 1440])
  test(`capture and administration fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const route of [
      "/add",
      "/admin",
      "/admin/members",
      "/admin/invitations",
      "/admin/settings",
      "/admin/processing",
      "/admin/activity",
      "/archive/a-letter-from-home/review",
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
        route,
      ).toBeLessThanOrEqual(0);
    }
    await upload(page);
    const card=page.locator(".capture-page").first();
    const bounds=await card.boundingBox();
    for(const control of await card.locator(".page-order-actions button").all()){
      const box=await control.boundingBox();expect(box!.x+box!.width).toBeLessThanOrEqual(bounds!.x+bounds!.width);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
test("camera and library are immediately usable without classification; unknown material saves safely", async ({page}) => {
  await page.goto("/add");
  await expect(page.getByLabel("Material type",{exact:true})).toHaveCount(0);
  for (const name of ["Take photo", "Choose from library"]) {
    await expect(page.getByRole("button",{name,exact:true})).toBeEnabled();
    const chooser=page.waitForEvent("filechooser");
    await page.getByRole("button",{name,exact:true}).click();
    expect((await chooser).isMultiple()).toBe(name==="Choose from library");
  }
  await expect(page.getByText("Rapid capture",{exact:true})).toHaveCount(0);
  await expect(page.getByRole("link",{name:/Record a memory/})).toHaveAttribute("href","/add/voice");
  await page.getByLabel("Upload existing images",{exact:true}).setInputFiles([photo,letter]);
  await expect(page.getByLabel("Material type",{exact:true})).toHaveValue("Other");
  await expect(page.getByRole("button",{name:/Transcribe/})).toHaveCount(0);
  await page.getByRole("button",{name:"Save to archive",exact:true}).click();
  await expect(page).toHaveURL(/add\/saved/);
  await expect(page.locator(".saved-file-list a")).toHaveCount(2);
  await expect(page.locator("h1")).toHaveText("Archive item, still to be catalogued");
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Export capture details"}).click();
  const data=JSON.parse(await fs.readFile((await (await download).path())!,"utf8"));
  expect(data.kind).toBe("Other");expect(data.suggestions).toEqual([]);expect(data.recollection.machineTranscript).toBe("");
});
test("save and capture another returns to the camera without a separate rapid mode",async({page})=>{
 await upload(page);await page.getByLabel("Material type",{exact:true}).selectOption("Photograph");
 await page.getByRole("button",{name:"Save & capture another",exact:true}).click();
 await expect(page.getByText("1 item captured",{exact:true})).toBeVisible();
 const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name:"Capture another",exact:true}).click();
 await (await chooser).setFiles(photo);
 await page.getByLabel("Material type",{exact:true}).selectOption("Photograph");
 await page.getByRole("button",{name:"Save to archive",exact:true}).click();
 await expect(page.locator(".saved-file-list a")).toHaveCount(1);
 await page.getByRole("link",{name:"Capture the next item"}).click();
 await expect(page.getByText("2 items captured",{exact:true})).toBeVisible();
});
for(const count of [1,2,4])test(`${count} selected letter pages save as one visual Letter without automatic transcription`,async({page})=>{
 await page.goto("/add");await page.getByLabel("Upload existing images",{exact:true}).setInputFiles(Array(count).fill(letter));
 await page.getByLabel("Material type",{exact:true}).selectOption("Letter");
 if(count>1)await expect(page.getByRole("checkbox",{name:"Keep together as one letter",exact:true})).toBeChecked();
 await page.getByRole("button",{name:"Save to archive",exact:true}).click();
 await expect(page.locator(".saved-file-list a")).toHaveCount(count);
 await expect(page.locator(".saved-original")).toHaveCount(count);
 await expect(page.locator("h1")).toHaveText("Letter, still to be catalogued");
 await expect(page.locator(".review-comparison")).toHaveCount(0);
 await expect(page.getByText("Transcription is optional",{exact:false})).toBeVisible();
});
test("multiple Object views keep their labels in one item",async({page})=>{
 await page.goto("/add");await page.getByLabel("Upload existing images",{exact:true}).setInputFiles([photo,letter]);
 await page.getByLabel("Material type",{exact:true}).selectOption("Object");
 await page.getByRole("combobox",{name:"Role for beach.jpg",exact:true}).selectOption("Inscription");
 await page.getByRole("button",{name:"Save to archive",exact:true}).click();
 await expect(page.locator("h1")).toHaveText("Object, still to be catalogued");
 await expect(page.locator(".saved-file-list a")).toHaveCount(2);await expect(page.locator(".saved-file-list")).toContainText("Inscription");
});
test("invite, role choice, optional person link and acceptance are archive-scoped", async ({
  page,
}) => {
  await page.goto("/admin/members");
  await page.getByRole("button", { name: "Invite member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Family helper");
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("helper@example.test");
  await dialog.getByRole("radio", { name: /Commenter/ }).check();
  await dialog
    .getByRole("combobox", { name: /Linked historical person/ })
    .selectOption("b0000000-0000-4000-8000-000000000007");
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    dialog.getByText("no email was sent.", { exact: false }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Back to the archive members" })
    .click();
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Invitations", exact: true })
    .click();
  const row = page
    .locator(".invitation-row")
    .filter({ hasText: "helper@example.test" });
  await expect(row).toContainText("Commenter");
  await row
    .getByRole("button", { name: "Simulate acceptance for Family helper" })
    .click();
  await expect(row).toContainText("accepted");
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  const member = page
    .locator(".member-row")
    .filter({ hasText: "helper@example.test" });
  await expect(member).toContainText("Sarah Allen");
  await expect(member).toContainText("Commenter");
});
test("member access changes retain history and protect the owner", async ({
  page,
}) => {
  await page.goto("/admin/members");
  await page.getByRole("button", { name: "Manage Jonas Allen" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: /Viewer/ }).check();
  await dialog.getByRole("button", { name: "Save member settings" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Transfer archive ownership",
  );
  await dialog.getByRole("button", { name: "Close member settings" }).click();
  await page.getByRole("button", { name: "Manage Jo Wilson" }).click();
  await dialog
    .getByRole("button", { name: "Suspend access", exact: true })
    .click();
  await page.getByRole("button", { name: "Suspended", exact: true }).click();
  await expect(
    page.locator(".member-row").filter({ hasText: "Jo Wilson" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Manage Jo Wilson" }).click();
  await dialog
    .getByRole("button", { name: "Remove access", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Confirm removal" }).click();
  await page.getByRole("button", { name: "Removed", exact: true }).click();
  await expect(page.locator(".member-row")).toContainText("Jo Wilson");
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Activity", exact: true })
    .click();
  await expect(page.locator(".archive-activity")).toContainText(
    "Historical contributions were retained.",
  );
});
test("role preview gates admin, processing and capture controls", async ({
  page,
}) => {
  await page.goto("/admin");
  await page
    .getByRole("combobox", { name: "Preview access as" })
    .selectOption("viewer");
  await expect(
    page.getByRole("heading", { name: "An admin’s place." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add to archive", exact: true }).click();
  await expect(
    page.getByText("Capturing material requires", { exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Change demo access preview" }).click();
  await page
    .getByRole("combobox", { name: "Preview access as" })
    .selectOption("editor");
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Processing", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Processing.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "An admin’s place." }),
  ).toBeVisible();
});
for (const route of [
  "/admin",
  "/admin/members",
  "/admin/invitations",
  "/admin/settings",
  "/admin/processing",
  "/admin/activity",
  "/archive/a-letter-from-home/review",
])
  test(`accessibility: ${route}`, async ({ page }) => {
    await page.goto(route);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  });
test("capture controls and invitation dialog are accessible when active", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await upload(page);
  await page.getByLabel("Material type",{exact:true}).selectOption("Letter");
  await page.getByText("Add a note or details (optional)",{exact:true}).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.goto("/admin/members");
  await page.getByRole("button", { name: "Invite member" }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
test("settings persist through navigation, pause invitations and export a truthful manifest", async ({
  page,
}) => {
  await page.goto("/admin/settings");
  await page
    .getByRole("textbox", { name: "Archive name", exact: true })
    .fill("The family collection");
  await page
    .getByRole("checkbox", { name: /Allow member invitations/ })
    .uncheck();
  await page.getByRole("button", { name: "Save archive settings" }).click();
  await expect(
    page.getByText("Settings saved in this demo session.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Members", exact: true })
    .click();
  await expect(page.locator(".admin-archive-name")).toHaveText(
    "The family collection",
  );
  await page.getByRole("button", { name: "Invite member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("New cousin");
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("new@example.test");
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(dialog.getByRole("alert")).toContainText("paused");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Archive settings", exact: true })
    .click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export entire archive · concept" })
    .click();
  const download = await pending;
  const data = JSON.parse(await fs.readFile((await download.path())!, "utf8"));
  expect(data.archive.name).toBe("The family collection");
  expect(data.exclusions).toContain("Original audio bytes");
  expect(data.illustrativeCatalogue.items).toHaveLength(8);
});
test("invitation renewal, revocation, duplicates and processing retry remain explicit", async ({
  page,
}) => {
  await page.goto("/admin/invitations");
  await page
    .getByRole("button", { name: "Renew invitation for Robert Allen" })
    .click();
  const row = page
    .locator(".invitation-row")
    .filter({ hasText: "robert@example.test" });
  await expect(row).toContainText("invited");
  await page
    .getByRole("button", { name: "Revoke invitation for Robert Allen" })
    .click();
  await expect(row).toContainText("revoked");
  await page.getByRole("button", { name: "Invite member" }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Lucy again");
  await dialog
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("LUCY@example.test");
  await dialog.getByRole("button", { name: "Send invitation" }).click();
  await expect(dialog.getByRole("alert")).toContainText("pending invitation");
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Archive administration" })
    .getByRole("link", { name: "Processing", exact: true })
    .click();
  await page.getByRole("button", { name: "Retry All of us, for once" }).click();
  await expect(
    page.locator(".job-row").filter({ hasText: "All of us, for once" }),
  ).toContainText("queued");
});
