import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { homeVisitHash, HOME_VISIT_COOKIE } from "../src/lib/home-visit";
const archive = "60000000-0000-4000-8000-000000000001";
const item = "60000000-0000-4000-8000-000000000004";
const sources = [
  "63000000-0000-4000-8000-000000000000",
  "63000000-0000-4000-9000-000000000000",
];
test("production build retrospectively converts two preserved HEICs and privately displays their JPEGs", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await page.goto("/sign-in?next=" + encodeURIComponent("/add"));
  await page
    .getByLabel("Email", { exact: true })
    .fill("visibility@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-fixture-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/add$/);
  await request.post("http://127.0.0.1:4301/__fixture/failure?preview=1");
  const failed = await page.request.post(`/api/v1/previews/${sources[0]}`, {
    headers: { origin: "http://127.0.0.1:4300" },
  });
  expect(failed.status(), await failed.text()).toBe(503);
  expect(await failed.json()).toMatchObject({
    code: "source_download_failed",
    stage: "download",
  });
  await page.goto(`/archive/${item}`);
  await expect(
    page.getByRole("button", { name: "Retry preview", exact: true }),
  ).toHaveCount(2, { timeout: 20000 });
  await request.post("http://127.0.0.1:4301/__fixture/failure?preview=0");
  for (let index = 0; index < 2; index++) {
    const image = page.locator(".saved-original").nth(index);
    await image
      .getByRole("button", { name: "Retry preview", exact: true })
      .click();
    await expect
      .poll(
        () =>
          image
            .locator("img")
            .evaluateAll(
              (nodes) =>
                nodes.length === 1 &&
                (nodes[0] as HTMLImageElement).naturalWidth > 0,
            ),
        { timeout: 30000 },
      )
      .toBe(true);
  }
  for (const source of sources) {
    const response = await page.request.post(`/api/v1/previews/${source}`, {
      headers: { origin: "http://127.0.0.1:4300" },
    });
    expect(response.status(), await response.text()).toBe(200);
    const image = await page.request.get(`/api/v1/previews/${source}`);
    expect(image.status()).toBe(200);
    expect(image.headers()["cache-control"]).toContain("private");
    expect((await sharp(await image.body()).metadata()).format).toBe("jpeg");
  }
  await page.goto(`/archive/${item}`);
  await expect(page.locator(".saved-original img")).toHaveCount(2);
  await expect
    .poll(() =>
      page
        .locator(".saved-original img")
        .evaluateAll((nodes) =>
          nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.reload();
  await expect
    .poll(() =>
      page
        .locator(".saved-original img")
        .evaluateAll(
          (nodes) =>
            nodes.length === 2 &&
            nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  const summary = await (
    await request.get("http://127.0.0.1:4301/__fixture/summary")
  ).json();
  expect(summary.displays).toHaveLength(2);
  expect(summary.imageSets).toHaveLength(2);
  for (const set of summary.imageSets) {
    expect(set.placeholder).toMatch(/^data:image\/webp;base64,/);
    expect(set.manifest.thumbnail.size).toBeLessThan(set.manifest.display.size);
    expect(set.manifest.small.size).toBeLessThanOrEqual(
      set.manifest.thumbnail.size,
    );
    const thumbnail = await page.request.get(
      `/api/v1/assets/${set.thumbnail_file_id}`,
    );
    expect(thumbnail.status()).toBe(200);
    expect(thumbnail.headers()["server-timing"]).toContain("storage;dur=");
    expect((await sharp(await thumbnail.body()).metadata()).format).toBe(
      "webp",
    );
  }
  expect(
    summary.attempts.every((a: { status: string }) => a.status === "complete"),
  ).toBe(true);
  for (const f of summary.displays) {
    expect(f.bucket_id).toBe("archive-derived");
    expect(f.status).toBe("stored");
  }
  expect(summary.originalHashes).toEqual([
    summary.originalHash,
    summary.originalHash,
  ]);
  for (const source of sources) {
    const response = await page.request.get(`/api/v1/files/${source}`);
    expect(
      createHash("sha256")
        .update(await response.body())
        .digest("hex"),
    ).toBe(summary.originalHash);
  }
  await page.goto(`/explore?archive=${archive}`);
  await expect
    .poll(() =>
      page
        .locator(".item-card img")
        .evaluateAll(
          (nodes) =>
            nodes.length === 1 &&
            nodes.every((n) => (n as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  const gridImage = page.locator(".item-card img").first();
  await expect(gridImage).toHaveAttribute("loading", "lazy");
  await expect(gridImage).toHaveAttribute("srcset", / \d+w/);
  await expect(gridImage).toHaveAttribute("sizes", /vw/);
  expect(
    await gridImage.evaluate((n) => (n as HTMLImageElement).currentSrc),
  ).toMatch(/\/api\/v1\/assets\//);
  expect(await gridImage.getAttribute("srcset")).not.toContain(
    summary.imageSets[0].display_file_id,
  );
  await expect(page.locator(".item-card .has-placeholder .image-presentation")).toHaveCSS(
    "background-image",
    /data:image\/webp/,
  );
  await expect(gridImage).toHaveCSS("opacity", "1");
  // Real Next server actions, with protocol fixture transport; actual SQL/RLS is tested separately.
  await page.goto(`/archive/${item}/manage`);
  await expect(
    page.getByRole("button", {
      name: "Review permanent deletion",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Archive item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore archived item", exact: true }),
  ).toBeVisible();
  await page.goto(`/explore?archive=${archive}`);
  await expect(page.locator(".item-card")).toHaveCount(0);
  await page.goto(`/explore?archive=${archive}&state=archived`);
  await expect(page.locator(".item-card")).toHaveCount(1);
  await page.goto(`/archive/${item}/manage`);
  await page
    .getByRole("button", { name: "Restore archived item", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Archive item", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Separate photographs",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog", {name: "Separate 2 photographs?"})).toBeVisible();
  await expect(page.getByText("Type SPLIT", {exact: true})).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", {name: "Separate photographs", exact: true}).click();
  await expect(
    page.getByRole("heading", { name: "Separated photographs", exact: true }),
  ).toBeVisible();
  const splitSummary = await (
    await request.get("http://127.0.0.1:4301/__fixture/summary")
  ).json();
  const children = splitSummary.items.filter(
    (r: { split_from?: string }) => r.split_from === item,
  );
  expect(children).toHaveLength(2);
  for (const child of children)
    expect(
      splitSummary.files.filter(
        (f: { item_id: string; purpose: string }) =>
          f.item_id === child.id && f.purpose === "original",
      ),
    ).toHaveLength(1);
  await page.goto(`/explore?archive=${archive}`);
  await expect(page.locator(".item-card")).toHaveCount(2);
  await page.goto(`/archive/${children[0].id}/manage`);
  await page.getByRole("button", { name: "Archive item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore archived item", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review permanent deletion", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Confirm permanent deletion",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Delete confirmation", { exact: true }).fill("DELETE");
  await expect(
    page.getByRole("button", {
      name: "Confirm permanent deletion",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /confirm permanent removal/ })
    .check();
  await request.post("http://127.0.0.1:4301/__fixture/failure?delete=1");
  await page
    .getByRole("button", { name: "Confirm permanent deletion", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Deletion is in progress",
  );
  await page.reload();
  await expect(
    page.getByText("Permanent deletion is in progress.", { exact: false }),
  ).toBeVisible();
  await request.post("http://127.0.0.1:4301/__fixture/failure?delete=0");
  await page
    .getByRole("button", { name: "Review permanent deletion", exact: true })
    .click();
  await page.getByLabel("Delete confirmation", { exact: true }).fill("DELETE");
  await page
    .getByRole("checkbox", { name: /confirm permanent removal/ })
    .check();
  await page
    .getByRole("button", { name: "Confirm permanent deletion", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/explore\\?archive=${archive}`));
  await expect(page.locator(".item-card")).toHaveCount(1);
  await request.post("http://127.0.0.1:4301/__fixture/many");
  const imageRequests = new Set<string>();
  page.on("request", (r) => {
    if (r.resourceType() === "image" && r.url().includes("/api/v1/assets/"))
      imageRequests.add(new URL(r.url()).pathname);
  });
  await page.goto(`/explore?archive=${archive}`);
  await expect(page.locator(".item-card")).toHaveCount(97);
  await expect
    .poll(() =>
      page
        .locator(".item-card img")
        .first()
        .evaluate((n) => (n as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  expect(imageRequests.size).toBeLessThan(97);
  const lastImage = page.locator(".item-card img").last();
  await expect(lastImage).toHaveAttribute("loading", "lazy");
  expect(
    await lastImage.evaluate((n) => (n as HTMLImageElement).naturalWidth),
  ).toBe(0);
  await lastImage.scrollIntoViewIfNeeded();
  await expect
    .poll(() => lastImage.evaluate((n) => (n as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/sign-in/);
  expect(
    (await page.request.get(`/api/v1/previews/${sources[0]}`)).status(),
  ).toBe(401);
  expect(
    (
      await page.request.get(
        `/api/v1/assets/${summary.imageSets[0].thumbnail_file_id}`,
      )
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get(
        `http://127.0.0.1:4301/storage/v1/object/authenticated/${summary.displays[0].bucket_id}/${summary.displays[0].storage_path}`,
      )
    ).status(),
  ).toBe(401);
});

test("People link relationally, preserve reported provenance and stay independent after a photograph split", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const seed = await (
    await request.post("http://127.0.0.1:4301/__fixture/person-item")
  ).json();
  const summary = async () =>
    (await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  const jina = seed.people.find(
    (p: { display_name: string }) => p.display_name === "Jina Allen",
  );
  const jan = seed.people.find(
    (p: { display_name: string }) => p.display_name === "Jan Allen",
  );
  await page.goto(`/sign-in?next=${encodeURIComponent(`/archive/${seed.id}`)}`);
  await page
    .getByLabel("Email", { exact: true })
    .fill("visibility@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-fixture-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Two family photographs", exact: true }),
  ).toBeVisible();
  await page.goto(`/explore?archive=${archive}&person=${jina.id}`);
  await expect(page.locator(".item-card")).toHaveCount(0); // Text notes alone never establish identity.
  await page.goto(`/archive/${seed.id}`);
  const people = page.getByRole("region", {
    name: "People in this item",
    exact: true,
  });
  await people.getByText("Earlier names and review", {exact: true}).click();
  await people
    .getByRole("button", { name: "Link to existing person", exact: true })
    .click();
  await expect(
    people.getByRole("button", { name: "Jina Allen · Family", exact: true }),
  ).toBeVisible();
  await people
    .getByRole("button", { name: "Jina Allen · Family", exact: true })
    .click();
  await expect(
    people.getByRole("link", { name: "View person", exact: false }),
  ).toHaveCount(1);
  let state = await summary();
  const linked = state.identifications.find(
    (i: { id: string }) => i.id === seed.report.id,
  );
  expect(linked).toMatchObject({
    person_id: jina.id,
    proposed_name: seed.report.proposed_name,
    proposed_by: seed.report.proposed_by,
    created_at: seed.report.created_at,
    status: "reported",
  });
  expect(
    state.provenance.some(
      (p: { field_path: string }) => p.field_path === "identification_linked",
    ),
  ).toBe(true);
  await people.getByText("Identification details", {exact: true}).click();
  await people
    .getByRole("button", {
      name: "Confirm reported identification",
      exact: true,
    })
    .click();
  await expect(people.getByText("confirmed ✓", { exact: false })).toBeVisible();
  await people
    .getByRole("button", { name: "+ Add person", exact: true })
    .click();
  await people.getByLabel("Search People in this archive").fill("Ja");
  await people
    .getByRole("button", { name: "Jan Allen · Family", exact: true })
    .click();
  await expect(
    people.getByRole("link", { name: "View person", exact: false }),
  ).toHaveCount(2);
  await people
    .getByRole("button", { name: "+ Add person", exact: true })
    .click();
  await people
    .getByLabel("Search People in this archive")
    .fill("A new relative");
  await people
    .getByRole("button", { name: "+ Add new person", exact: true })
    .click();
  await people.getByLabel("Name", { exact: true }).fill("A new relative");
  await people
    .getByLabel("Relationship/category if known")
    .selectOption("family");
  await people
    .getByRole("button", {
      name: "Create Person and link to this item",
      exact: true,
    })
    .click();
  await expect(
    people.getByRole("link", { name: "View person", exact: false }),
  ).toHaveCount(3);
  await people
    .getByRole("button", {
      name: "Remove association with Jan Allen",
      exact: true,
    })
    .click();
  await expect(
    people.getByRole("link", { name: "View person", exact: false }),
  ).toHaveCount(2);
  state = await summary();
  expect(state.people.some((p: { id: string }) => p.id === jan.id)).toBe(true);
  expect(
    state.identifications.find(
      (i: { person_id: string }) => i.person_id === jan.id,
    ).status,
  ).toBe("rejected");
  await page.goto(`/people/${jina.id}?archive=${archive}`);
  await expect(
    page
      .getByRole("region", { name: "Items featuring this Person" })
      .locator(".item-card"),
  ).toHaveCount(1);
  await page.goto(`/explore?archive=${archive}&person=${jina.id}`);
  await expect(page.locator(".item-card")).toHaveCount(1);
  await page
    .getByRole("combobox", { name: "People", exact: true })
    .selectOption(jan.id);
  await expect(page.locator(".item-card")).toHaveCount(0);
  await page.goto(`/archive/${seed.id}`);
  await page
    .getByRole("link", {
      name: "Separate photographs",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog", {name: "Separate 2 photographs?"})).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByLabel("Split confirmation", {exact: true})).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", {name: "Separate photographs", exact: true}).click();
  await expect(
    page.getByRole("heading", { name: "Separated photographs", exact: true }),
  ).toBeVisible();
  state = await summary();
  const children = state.items.filter(
    (i: { split_from?: string }) => i.split_from === seed.id,
  );
  expect(children).toHaveLength(2);
  expect(
    state.recollections.filter((r: { item_id: string }) =>
      children.some((c: { id: string }) => c.id === r.item_id),
    ),
  ).toHaveLength(0);
  expect(
    state.identifications.filter((r: { item_id: string }) =>
      children.some((c: { id: string }) => c.id === r.item_id),
    ),
  ).toHaveLength(0);
  await page.goto(`/archive/${children[0].id}/edit`);
  await page
    .getByLabel("Title / caption", { exact: true })
    .fill("Jina on her own");
  await page.getByLabel("Date", { exact: true }).fill("1965");
  await page.getByText("Original Where wording", { exact: true }).click();
  await page
    .getByLabel("Reported Where notes (text)", { exact: true })
    .fill("India");
  await expect(page.locator('input[type="hidden"][name="kind"]')).toHaveValue("Photograph");
  await page
    .getByLabel("Notes / context", { exact: true })
    .fill("Only this photograph");
  await page
    .getByLabel("Add a recollection (optional)", { exact: true })
    .fill("Jina-specific new words");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Changes saved" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "People in this item", exact: true })
    .getByRole("button", { name: "+ Add person", exact: true })
    .click();
  await page.getByLabel("Search People in this archive").fill("Ji");
  await page
    .getByRole("button", { name: "Jina Allen · Family", exact: true })
    .click();
  state = await summary();
  expect(
    state.items.find((i: { id: string }) => i.id === children[0].id),
  ).toMatchObject({
    title: "Jina on her own",
    reported_date: "1965",
    reported_place: "India",
  });
  expect(
    state.items.find((i: { id: string }) => i.id === children[1].id),
  ).toMatchObject({
    title: "Photograph, still to be catalogued",
    reported_date: "",
    reported_place: "",
    notes: "",
    catalogued_at: null,
  });
  await page.goto(`/archive/${children[1].id}`);
  await expect(
    page.getByText("No recollection yet.", { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "People in this item" })
      .getByText("No People linked yet.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/people/${jina.id}?archive=${archive}`);
  await expect(
    page
      .getByRole("region", { name: "Items featuring this Person" })
      .locator(".item-card"),
  ).toHaveCount(1); // Archived parent is excluded.
  await page.goto(`/explore?archive=${archive}&person=${jina.id}`);
  await expect(page.locator(".item-card")).toHaveCount(1);
  // Shared context remains untouched until an Editor chooses a particular photograph.
  const originalNotes = state.recollections.filter((r: {item_id: string}) => r.item_id === seed.id);
  await page.goto(`/archive/${seed.id}/manage`);
  const review = page.locator("#earlier-notes");
  await expect(review.getByRole("heading", {name: "Review earlier notes"})).toBeVisible();
  const personForm = review.locator("form").filter({hasText: "Person: Jina Allen"});
  // Forging a destination outside the resulting photographs is rejected by the server action.
  await personForm.getByRole("combobox").evaluate((node, invalid) => {
    const option = new Option("Wrong destination", invalid);
    (node as HTMLSelectElement).add(option);
  }, seed.id);
  await personForm.getByRole("combobox").selectOption(seed.id);
  await personForm.getByRole("button", {name: "Link Person", exact: true}).click();
  await expect(review.getByRole("status")).toContainText("Choose one of the photographs");
  await personForm.getByRole("combobox").selectOption(children[1].id);
  await personForm.getByRole("button", {name: "Link Person", exact: true}).click();
  await expect(review.getByRole("status")).toContainText("Person linked");
  const noteForm = review.locator("form").filter({has: page.getByRole("button", {name: "Copy recollection", exact: true})}).first();
  await noteForm.getByRole("combobox").selectOption(children[1].id);
  await noteForm.getByRole("button", {name: "Copy recollection", exact: true}).click();
  await expect(review.getByRole("status")).toContainText("Recollection copied");
  state = await summary();
  expect(state.recollections.filter((r: {item_id: string}) => r.item_id === seed.id)).toEqual(originalNotes);
  expect(state.recollections.filter((r: {item_id: string}) => r.item_id === children[1].id)).toHaveLength(1);
  await page.goto(`/archive/${children[1].id}`);
  await expect(page.getByRole("heading", {name: "Jina Allen", exact: true})).toBeVisible();
  await expect(page.getByRole("heading", {name: "Photograph, still to be catalogued", exact: true})).toHaveCount(0);
  await expect(page.getByText("Earlier shared recollection", {exact: false})).toBeVisible();
});

test("People use real archival stacks, small private thumbnails, batched reads and immediate placeholders", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const seed = await (
    await request.post("http://127.0.0.1:4301/__fixture/people-material")
  ).json();
  await page.context().addCookies([
    {
      name: "active_archive",
      value: archive,
      url: "http://127.0.0.1:4300",
      httpOnly: true,
    },
  ]);
  await page.route("**/*", (route) => {
    const h = route.request().headers();
    return h["next-router-prefetch"] === "1" || h.purpose === "prefetch"
      ? route.abort()
      : route.continue();
  });
  await page.goto("/sign-in");
  await page
    .getByLabel("Email", { exact: true })
    .fill("visibility@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-fixture-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForLoadState("networkidle");
  const state = await (
    await request.get("http://127.0.0.1:4301/__fixture/summary")
  ).json();
  const smallIds = new Set(
    state.imageSets.map((s: { small_file_id: string }) => s.small_file_id),
  );
  const requested: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "image" && r.url().includes("/api/v1/"))
      requested.push(r.url());
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/assets/*", async (route) => {
    await gate;
    await route.continue();
  });
  await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto(`/people?archive=${archive}`, {
    waitUntil: "domcontentloaded",
  });
  const cards = page.locator(".archival-people-grid .person-card");
  await expect(cards).toHaveCount(33);
  const many = cards.filter({
    has: page.getByRole("heading", { name: "01 Many materials", exact: true }),
  });
  const single = cards.filter({
    has: page.getByRole("heading", { name: "02 One material", exact: true }),
  });
  const empty = cards.filter({
    has: page.getByRole("heading", { name: "03 No material", exact: true }),
  });
  await expect(many.locator(".material-leaf")).toHaveCount(4);
  await expect(single.locator(".material-leaf")).toHaveCount(1);
  await expect(empty.locator("img")).toHaveCount(0);
  await expect(empty.getByText("A story still to gather")).toBeVisible();
  for (const id of await many
    .locator(".material-leaf")
    .evaluateAll((nodes) =>
      nodes.map((n) => (n as HTMLElement).dataset.itemId),
    ))
    expect(seed.materialIds).toContain(id);
  await expect(many.locator(".has-placeholder .image-presentation").first()).toHaveCSS(
    "background-image",
    /data:image\/webp/,
  );
  expect(
    await many
      .locator("img")
      .first()
      .evaluate((n) => (n as HTMLImageElement).naturalWidth),
  ).toBe(0);
  await expect(many.locator("img").first()).not.toHaveAttribute("srcset");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  const last = cards.last().locator("img").first();
  await expect(last).toHaveAttribute("loading", "lazy");
  expect(await last.evaluate((n) => (n as HTMLImageElement).naturalWidth)).toBe(
    0,
  );
  release();
  await expect
    .poll(() =>
      many
        .locator("img")
        .first()
        .evaluate((n) => (n as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const queries = await (
    await request.get("http://127.0.0.1:4301/__fixture/metrics")
  ).json();
  expect(queries["/rest/v1/people"]).toBe(1);
  expect(queries["/rest/v1/archives"]).toBe(1);
  expect(queries["/rest/v1/archive_memberships"]).toBe(1);
  expect(queries["/rest/v1/identifications"]).toBe(2); // >127 links, paged once per result page, never once per Person.
  expect(
    await page.evaluate(
      () =>
        performance
          .getEntriesByType("resource")
          .filter((r) => r.name.includes("/api/v1/workspace")).length,
    ),
  ).toBe(0);
  await last.scrollIntoViewIfNeeded();
  await expect
    .poll(() => last.evaluate((n) => (n as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  for (const url of requested) {
    expect(url).toContain("/api/v1/assets/");
    expect(smallIds.has(new URL(url).pathname.split("/").pop())).toBe(true);
  }
  const firstUrl = await many.locator("img").first().getAttribute("src");
  const first = await page.request.get(firstUrl!);
  expect(first.status()).toBe(200);
  expect(first.headers()["cache-control"]).toBe(
    "private, no-cache, must-revalidate",
  );
  await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");
  const cached = await page.request.get(firstUrl!, {
    headers: { "If-None-Match": first.headers().etag },
  });
  expect(cached.status()).toBe(304);expect(cached.headers()["cache-control"]).toBe("private, no-cache, must-revalidate");
  const counts = await (
    await request.get("http://127.0.0.1:4301/__fixture/metrics")
  ).json();
  expect(Object.keys(counts).some((p) => p.startsWith("/storage/"))).toBe(
    false,
  );
  expect(counts["/rest/v1/archive_item_files"]).toBe(1);
  expect(
    (
      await request.get(firstUrl!, {
        headers: { "If-None-Match": first.headers().etag },
      })
    ).status(),
  ).toBe(401);
  await many.click();
  await expect(
    page
      .getByRole("region", { name: "Items featuring this Person" })
      .getByRole("heading", { name: "Photographs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Letters & documents", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recollections", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Words preserved with this linked photograph"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dates in the material", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/archive-people-person.png",
    fullPage: true,
  });
  await page.goto(`/people?archive=${archive}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "/private/tmp/archive-people-stacks.png",
    fullPage: false,
  });
});

test("Places are scoped archive entry points with relational filtering, preserved reports and small archival piles", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const seed = await (
    await request.post("http://127.0.0.1:4301/__fixture/places-material")
  ).json();
  const summary = async () =>
    (await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  const main = seed.places[0],
    empty = seed.places[2],
    item = seed.materialIds[0];
  await page.context().addCookies([
    {
      name: "active_archive",
      value: archive,
      url: "http://127.0.0.1:4300",
      httpOnly: true,
    },
  ]);
  await page.route("**/*", (route) => {
    const h = route.request().headers();
    return h["next-router-prefetch"] === "1" || h.purpose === "prefetch"
      ? route.abort()
      : route.continue();
  });
  await page.goto("/sign-in");
  await page
    .getByLabel("Email", { exact: true })
    .fill("visibility@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-fixture-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.waitForLoadState("networkidle");
  await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto(`/places?archive=${archive}`);
  await expect(
    page.getByRole("heading", { name: "Places", exact: true }),
  ).toBeVisible();
  const cards = page.locator(".place-archive-card");
  await expect(cards).toHaveCount(33);
  await expect(cards.nth(0).locator(".material-leaf")).toHaveCount(4);
  await expect(cards.nth(1).locator(".material-leaf")).toHaveCount(1);
  await expect(cards.nth(2).locator("img")).toHaveCount(0);
  await expect(cards.first().locator("img").first()).toHaveAttribute(
    "data-image-variant",
    "small",
  );
  await expect(cards.first().locator(".has-placeholder .image-presentation").first()).toHaveCSS(
    "background-image",
    /data:image\/webp/,
  );
  await expect(cards.last().locator("img").first()).toHaveAttribute(
    "loading",
    "lazy",
  );
  expect(
    await cards
      .last()
      .locator("img")
      .first()
      .evaluate((n) => (n as HTMLImageElement).naturalWidth),
  ).toBe(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  const counts = await (
    await request.get("http://127.0.0.1:4301/__fixture/metrics")
  ).json();
  expect(counts["/rest/v1/places"]).toBe(1);
  expect(counts["/rest/v1/item_places"]).toBe(2);
  expect(counts["/rest/v1/archives"]).toBe(1);
  expect(counts["/rest/v1/archive_memberships"]).toBe(1);
  await cards.last().locator("img").first().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      cards
        .last()
        .locator("img")
        .first()
        .evaluate((n) => (n as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Add a place", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a place" });
  await dialog
    .getByLabel("Place name", { exact: true })
    .fill("A meaningful family home");
  await dialog.getByRole("button", { name: "Save place", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(cards).toHaveCount(34);
  let state = await summary();
  const created = state.places.find(
    (p: { name: string }) => p.name === "A meaningful family home",
  );
  expect(created.archive_id).toBe(archive);
  await page.goto(`/places/${created.id}?archive=${archive}`);
  await expect(
    page.getByText("No material linked to this Place yet.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit place", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Edit place" });
  await edit
    .getByText("More about this place (optional)", { exact: true })
    .click();
  await edit.getByLabel("Country", { exact: true }).fill("Australia");
  await edit.getByRole("button", { name: "Save place", exact: true }).click();
  await expect(edit).not.toBeVisible();
  await page.goto(`/places/${main.id}?archive=${archive}`);
  await expect(
    page.getByRole("heading", { name: "Photographs", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Letters & documents", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "People appearing in material connected to this place",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This connection does not establish that someone lived here.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dates in the material", exact: true }),
  ).toBeVisible();
  await page.goto(`/explore?archive=${archive}&place=${main.id}`);
  await expect(page.locator(".item-card")).toHaveCount(5);
  await page
    .getByRole("combobox", { name: "Place", exact: true })
    .selectOption(empty.id);
  await expect(page.locator(".item-card")).toHaveCount(0);
  await page.goto(`/archive/${item}/edit`);
  await page.getByText("Original Where wording", { exact: true }).click();
  await page
    .getByLabel("Reported Where notes (text)", { exact: true })
    .fill("Near Auroville, as remembered");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Changes saved" }),
  ).toBeVisible();
  await page.goto(`/archive/${item}`);
  const where = page.getByRole("region", { name: "Places in this item" });
  await where.getByText("Earlier Where wording", {exact:true}).click();
  await expect(
    where.getByText("Near Auroville, as remembered", { exact: true }),
  ).toBeVisible();
  await where
    .getByRole("button", { name: "Link to existing place", exact: true })
    .click();
  await where.getByLabel("Search Places in this archive").fill("meaningful");
  await where
    .getByRole("button", {
      name: "A meaningful family home · Australia",
      exact: true,
    })
    .click();
  await expect(where.locator(`a[href^="/places/${created.id}"]`)).toBeVisible();
  state = await summary();
  expect(
    state.items.find((r: { id: string }) => r.id === item).reported_place,
  ).toBe("Near Auroville, as remembered");
  const linked = state.itemPlaces.find(
    (l: { item_id: string; place_id: string; status: string }) =>
      l.item_id === item && l.place_id === created.id && l.status !== "removed",
  );
  expect(linked).toMatchObject({
    source: "legacy_text",
    reported_text: "Near Auroville, as remembered",
  });
  await where
    .getByRole("button", { name: "Change primary place", exact: true })
    .click();
  await where
    .getByLabel("Search Places in this archive")
    .fill("A new inline location");
  await where
    .getByRole("button", { name: "+ Add new place", exact: true })
    .click();
  await where
    .getByRole("button", {
      name: "Create Place and link to this item",
      exact: true,
    })
    .click();
  await expect(
    where.getByText("A new inline location", { exact: true }),
  ).toBeVisible();
  state = await summary();
  const inline = state.places.find(
    (p: { name: string }) => p.name === "A new inline location",
  );
  expect(
    state.itemPlaces.some(
      (l: { item_id: string; place_id: string; status: string }) =>
        l.item_id === item &&
        l.place_id === inline.id &&
        l.status === "reported",
    ),
  ).toBe(true);
  await where
    .getByRole("button", {
      name: "Remove association with A new inline location",
      exact: true,
    })
    .click();
  state = await summary();
  expect(state.places.some((p: { id: string }) => p.id === inline.id)).toBe(
    true,
  );
  expect(
    state.items.find((r: { id: string }) => r.id === item).reported_place,
  ).toBe("Near Auroville, as remembered");
  await page.goto(`/explore?archive=${archive}&place=${main.id}`);
  await expect(page.locator(".item-card")).toHaveCount(4); // Retained Where wording alone cannot restore a removed canonical link.
  await page.goto(`/places?archive=${archive}`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(cards.first().locator("img").first()).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "/private/tmp/archive-places-overview.png",
    fullPage: false,
  });
  expect(
    (
      await request.get(`/places/${main.id}?archive=${archive}`, {
        maxRedirects: 0,
      })
    ).status(),
  ).toBe(307);
});

test("home is a visit-stable private scrapbook using real small variants and working material links", async ({page, request, browser}) => {
  test.setTimeout(90000);
  await page.context().addCookies([{name: "active_archive", value: archive, url: "http://127.0.0.1:4300"}]);
  await page.route("**/*", route => {
    const h = route.request().headers();
    return h["next-router-prefetch"] === "1" || h.purpose === "prefetch" ? route.abort() : route.continue();
  });
  const images: string[] = [];
  page.on("request", r => {if (r.resourceType() === "image" && r.url().includes("/api/v1/")) images.push(r.url());});
  await page.goto("/sign-in?next=%2F");
  await page.getByLabel("Email", {exact: true}).fill("visibility@example.test");
  await page.getByLabel("Password", {exact: true}).fill("local-fixture-password");
  await page.locator("form").getByRole("button", {name: "Sign in", exact: true}).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("An archive, still being discovered.", {exact: true})).toHaveCount(0);
  const pieces = page.locator(".home-scrapbook .scrapbook-piece");
  await expect.poll(() => pieces.count()).toBeGreaterThan(3);
  const initialCount = await pieces.count();
  expect(initialCount).toBeLessThanOrEqual(12);
  const state = await (await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  const smallIds = new Set(state.imageSets.map((s: {small_file_id: string}) => s.small_file_id));
  const links = await pieces.locator(".scrapbook-caption").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
  const arrangement=await page.locator(".scrapbook-home").getAttribute("data-arrangement");
  const sessionCookies=await page.context().cookies();
  const visit=sessionCookies.find(c=>c.name===HOME_VISIT_COOKIE)!;
  expect(visit.value).toMatch(/^[a-f0-9-]{36}$/);expect(visit.httpOnly).toBe(true);expect(visit.expires).toBe(-1);
  for (const link of links) expect(state.items.some((i: {id: string; archived_at?: string}) => link?.includes(i.id) && !i.archived_at)).toBe(true);
  await expect(pieces.first().locator(".has-placeholder .image-presentation")).toHaveCSS("background-image", /data:image\/webp/);
  await expect(pieces.last().locator("img")).toHaveAttribute("loading", "lazy");
  await expect(pieces.first().locator("img")).toHaveAttribute("data-image-variant", "small");
  await expect(pieces.first().locator("img")).not.toHaveAttribute("srcset");
  await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");
  await page.reload();
  await expect(pieces).toHaveCount(initialCount);
  await page.waitForLoadState("networkidle");
  const metrics = await (await request.get("http://127.0.0.1:4301/__fixture/metrics")).json();
  expect(metrics["/rest/v1/people"]).toBe(1);
  expect(metrics["/rest/v1/places"]).toBe(1);
  expect(metrics["/rest/v1/archives"]).toBe(1);
  expect(metrics["/rest/v1/archive_memberships"]).toBe(1);
  expect(metrics["/rest/v1/recollections"]).toBe(1);
  expect(metrics["/rest/v1/item_places"]).toBeLessThanOrEqual(2);
  expect(metrics["/rest/v1/identifications"]).toBeLessThanOrEqual(2);
  expect(await pieces.locator(".scrapbook-caption").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")))).toEqual(links);
  await expect(page.locator(".scrapbook-home")).toHaveAttribute("data-arrangement",arrangement!);
  await page.setViewportSize({width: 375, height: 850});
  const bottomNav = await page.locator(".mobile-primary-nav").boundingBox();
  expect(bottomNav!.y + bottomNav!.height).toBeCloseTo(850, 0);
  const slider = page.locator(".home-slider");
  await page.getByRole("button", {name: "Next photographs"}).click();
  await expect.poll(() => slider.evaluate(element => element.scrollLeft)).toBeGreaterThan(100);
  await page.getByRole("button", {name: "Previous photographs"}).click();
  await expect.poll(() => slider.evaluate(element => element.scrollLeft)).toBeLessThan(10);
  const proportions = await pieces.first().locator(".archive-image").evaluate(element => {
    const frame = element as HTMLElement;
    const image = frame.querySelector("img") as HTMLImageElement;
    return { frame: frame.clientWidth / frame.clientHeight, source: image.naturalWidth / image.naturalHeight };
  });
  expect(Math.abs(proportions.frame - proportions.source)).toBeLessThan(.08);
  const homeAddress = page.url();
  const homeCard = pieces.first();
  const cardImagesBeforeViewer = [...images];
  await homeCard.getByRole('button',{name:/View photo:/}).click();
  const silentViewer=page.getByRole('dialog');
  await expect(silentViewer.getByRole('button')).toHaveCount(2);
  await expect(silentViewer.locator('.memory-cinema')).toHaveAttribute('data-playing','true');
  await silentViewer.getByRole('button',{name:'Pause photo motion',exact:true}).click();
  await expect(silentViewer.locator('.memory-cinema')).toHaveAttribute('data-playing','false');
  await silentViewer.getByRole('button',{name:'Close photo',exact:true}).click();
  await homeCard.getByRole("button", {name: "Record a message", exact: true}).click();
  const memory = homeCard.getByRole("region", {name: /Record a memory about/});
  await expect(memory.getByRole("button", {name: "Record", exact: true})).toBeVisible();
  await memory.getByLabel("Who is speaking?", {exact: false}).fill("Jan and Craig");
  const peopleChoices = memory.getByRole("checkbox");
  expect(await peopleChoices.count()).toBeGreaterThan(1);
  await peopleChoices.nth(0).check();
  await peopleChoices.nth(1).check();
  await expect(peopleChoices.nth(0)).toBeChecked();
  await expect(peopleChoices.nth(1)).toBeChecked();
  await memory.getByLabel("Upload audio recording").setInputFiles("public/audio/example-recollection.wav");
  await expect(memory.getByLabel("Preview selected audio")).toBeVisible();
  await expect(memory.getByRole("button", {name: "Save voice recollection"})).toBeEnabled();
  expect(page.url()).toBe(homeAddress);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({path: "/private/tmp/home-voice-memory-375.png", fullPage: true});
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", {name: "Close photo", exact: true}).click();
  await expect(memory).toBeHidden();
  const memoryItem = links[0]!.split("/archive/")[1].split("?")[0];
  await request.post(`http://127.0.0.1:4301/__fixture/home-audio?item=${memoryItem}`);
  await page.reload();
  await page.route("**/api/v1/files/*", async route => {await new Promise(resolve=>setTimeout(resolve,700));await route.continue();});
  await homeCard.getByRole("button", {name: /Listen to 2 memories about/}).click();
  const viewer=page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('.archive-image img')).toHaveAttribute('data-image-variant','display');
  await expect(viewer.getByText("Loading voice memory…", {exact:true})).toBeVisible();
  await expect(viewer.getByRole('button')).toHaveCount(2);
  await expect(viewer.getByRole('slider')).toHaveCount(0);
  await expect(viewer.getByRole('link')).toHaveCount(0);
  const cinemaBox=await viewer.locator('.memory-stage').boundingBox();
  expect(cinemaBox!.height).toBeCloseTo(850,0);
  expect(cinemaBox!.width).toBeCloseTo(375,0);
  await expect(viewer.locator('.memory-cinema')).toHaveAttribute('data-playing','true');
  await viewer.getByRole('button',{name:'Pause memory',exact:true}).click();
  await expect(viewer.locator('.memory-cinema')).toHaveAttribute('data-playing','false');
  await viewer.getByRole('button',{name:'Play memory',exact:true}).click();
  await viewer.getByLabel("Play Jan's memory").evaluate((audio: HTMLAudioElement)=>{audio.pause();audio.dispatchEvent(new Event('ended'));});
  await expect(homeCard.getByLabel("Play Jan's memory")).toHaveCount(0);
  await expect(viewer.getByLabel("Play Craig's memory")).toHaveCount(1);
  await expect(viewer.locator('.memory-cinema')).toHaveAttribute('data-playing','true');
  await viewer.getByRole('button',{name:'Pause memory',exact:true}).click();
  await expect(viewer.locator('.memory-cinema')).toHaveAttribute('data-playing','false');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(viewer.locator('.memory-cinema')).toHaveCSS('animation-name','none');
  await page.screenshot({path: "/private/tmp/memory-viewer-375.png"});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path: "/private/tmp/memory-viewer-1440.png"});
  await page.setViewportSize({width:375,height:850});
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(homeCard.getByRole("button", {name:/Listen to 2 memories about/})).toBeFocused();
  await homeCard.getByRole('button',{name:/View photo:/}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(page.url()).toBe(homeAddress);
  await page.getByRole('button',{name:'Close photo',exact:true}).click();
  await page.unroute("**/api/v1/files/*");
  await page.emulateMedia({reducedMotion:'no-preference'});
  const homeCommentReads: string[] = [];
  page.on("request", request => {
    if (request.url().includes("/api/v1/conversations/")) homeCommentReads.push(request.url());
  });
  const horizontalPosition = await slider.evaluate(element => element.scrollLeft);
  await homeCard.getByRole("button", {name: /(?:Add a comment|comments?) on/}).click();
  const homeThread = homeCard.getByRole("region", {name: "Family conversation", exact: true});
  await expect(homeThread).toBeVisible();
  expect(page.url()).toBe(homeAddress);
  expect(homeCommentReads).toHaveLength(1);
  expect(homeCommentReads[0]).toContain(links[0]!.split("/archive/")[1].split("?")[0]);
  const homeComposer = homeThread.getByLabel("Add a comment", {exact: true});
  await homeComposer.fill("A quick memory from Home.");
  await homeThread.getByRole("button", {name: "Post comment", exact: true}).click();
  await expect(homeThread.getByText("A quick memory from Home.", {exact: true})).toBeVisible();
  await expect(homeComposer).toHaveValue("");
  await expect(homeComposer).toBeFocused();
  expect(page.url()).toBe(homeAddress);
  expect(Math.abs(await slider.evaluate(element => element.scrollLeft) - horizontalPosition)).toBeLessThan(5);
  await homeComposer.fill("Unsent Home draft.");
  await homeCard.getByRole("button", {name: /Hide conversation on/}).click();
  const closedHomeComments = homeCard.getByRole("button", {name: /comments? on/});
  await expect(closedHomeComments).toBeFocused();
  await closedHomeComments.click();
  await expect(homeComposer).toHaveValue("Unsent Home draft.");
  expect(homeCommentReads).toHaveLength(1);
  await page.setViewportSize({width: 375, height: 440});
  await homeComposer.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({path: "/private/tmp/home-inline-comment-keyboard.png"});
  await page.setViewportSize({width: 375, height: 850});
  await homeCard.getByRole("button", {name: /Hide conversation on/}).click();
  await page.reload();
  await pieces.first().getByRole("button", {name: /comments? on/}).click();
  await expect(pieces.first().getByText("A quick memory from Home.", {exact: true})).toBeVisible();
  await pieces.first().getByRole("button", {name: /Hide conversation on/}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await pieces.last().scrollIntoViewIfNeeded();
  await expect.poll(() => pieces.last().locator("img").evaluate(n => (n as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({path: "/private/tmp/scrapbook-mobile.png", fullPage: true});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.screenshot({path: "/private/tmp/scrapbook-desktop.png", fullPage: true});
  for (const url of cardImagesBeforeViewer) {
    expect(url).toContain("/api/v1/assets/");
    expect(smallIds.has(new URL(url).pathname.split("/").pop())).toBe(true);
  }
  await pieces.first().locator(".scrapbook-caption").click();
  await expect(page).toHaveURL(new RegExp(links[0]!.split("?")[0]));
  await expect(page.locator(".saved-original")).not.toHaveCount(0);
  await page.goBack();
  await expect(pieces).toHaveCount(initialCount);
  expect(await pieces.locator(".scrapbook-caption").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")))).toEqual(links);
  await expect(page.locator(".scrapbook-home")).toHaveAttribute("data-arrangement",arrangement!);
  const nextVisit=await browser.newContext({baseURL:"http://127.0.0.1:4300"});
  await nextVisit.addCookies(sessionCookies.filter(c=>c.name!==HOME_VISIT_COOKIE));
  const nextPage=await nextVisit.newPage();await nextPage.goto("/");
  await expect(nextPage.locator(".scrapbook-piece")).toHaveCount(initialCount);
  expect((await nextVisit.cookies()).find(c=>c.name===HOME_VISIT_COOKIE)!.value).not.toBe(visit.value);
  await nextVisit.close();
});

test("desktop navigation shows feedback inside the selected link while loading", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});
  await page.route("**/places*", async route => {
    if (route.request().headers()["next-router-prefetch"]) return route.abort();
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto("/sign-in");
  await page.getByLabel("Email", {exact:true}).fill("visibility@example.test");
  await page.getByLabel("Password", {exact:true}).fill("local-fixture-password");
  await page.getByRole("button", {name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
  const link = page.getByRole("navigation", {name:"Main navigation"}).locator('a[href="/places"]');
  await link.hover();
  await expect(link).toHaveCSS("background-color", "rgb(227, 232, 220)");
  await link.click();
  await expect(link.locator('[data-pending="true"]')).toBeVisible();
  await expect(page).toHaveURL(/\/places$/);
  await expect(link.locator('[data-pending="true"]')).toHaveCount(0);
});

test("quick catalogue saves fields independently and supports a private attributed family conversation", async ({page,request}) => {
  test.setTimeout(120000);
  page.setDefaultTimeout(10000);
  const seed=await (await request.post("http://127.0.0.1:4301/__fixture/quick-photos")).json();
  await page.context().addCookies([{name:"active_archive",value:archive,url:"http://127.0.0.1:4300"}]);
  await page.route("**/*",route => {
    const h=route.request().headers();return h["next-router-prefetch"]==="1" || h.purpose==="prefetch" ? route.abort() : route.continue();
  });
  await page.goto("/sign-in?next="+encodeURIComponent(`/quick-catalogue?archive=${archive}`));
  await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");
  await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");
  await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Quick catalogue",exact:true})).toBeVisible();
  await expect(page.locator(".quick-photo h2")).toHaveText("Quick photograph 1");
  await expect(page.locator(".quick-photo img")).toHaveAttribute("data-image-variant","small");
  await expect(page.locator(".quick-photo img")).not.toHaveAttribute("srcset");
  const summary=async()=> (await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  const person=seed.people[0];
  const who=page.getByRole("region",{name:"People in this item",exact:true});
  await who.getByRole("button",{name:"+ Add person",exact:true}).click();
  await who.getByLabel("Search People in this archive").fill(person.display_name);
  await who.getByRole("list",{name:"Matching People"}).getByRole("button").first().click();
  await expect(who.getByRole("status")).toHaveText("Person saved.");
  let state=await summary();
  expect(state.identifications.some((i:{item_id:string;person_id:string})=>i.item_id===seed.ids[0] && i.person_id===person.id)).toBe(true);
  expect(state.recollections.filter((r:{item_id:string})=>r.item_id===seed.ids[0])).toHaveLength(0);
  const when=page.getByRole("region",{name:"When",exact:true});
  await when.getByRole("button",{name:"Edit date",exact:true}).click();
  await when.getByRole("combobox",{name:"Date precision",exact:true}).selectOption("approximate");
  await when.getByLabel("Date",{exact:true}).fill("1984");
  await when.getByRole("button",{name:"Save date",exact:true}).click();
  await expect(when.getByRole("status")).toHaveText("Date saved.");
  await expect(when.getByText("c. 1984",{exact:true})).toBeVisible();
  const where=page.getByRole("region",{name:"Places in this item",exact:true});
  await where.getByRole("button",{name:"+ Add place",exact:true}).click();
  await where.getByLabel("Search Places in this archive").fill("Quick family home");
  await where.getByRole("button",{name:"+ Add new place",exact:true}).click();
  await where.getByRole("button",{name:"Create Place and link to this item",exact:true}).click();
  await expect(where.getByRole("status")).toHaveText("Place saved.");
  state=await summary();
  expect(state.items.find((i:{id:string})=>i.id===seed.ids[0])).toMatchObject({reported_date:"1984",date_precision:"approximate"});
  expect(state.recollections.filter((r:{item_id:string})=>r.item_id===seed.ids[0])).toHaveLength(0);
  await page.getByText("Add or edit a caption",{exact:true}).click();
  const caption=page.getByRole("region",{name:"Caption",exact:true});
  await caption.getByRole("button",{name:"Edit caption",exact:true}).click();
  await caption.getByLabel("Title / caption",{exact:true}).fill("An afternoon at home");
  await caption.getByRole("button",{name:"Save caption",exact:true}).click();
  await expect(caption.getByRole("status")).toHaveText("Caption saved.");
  await expect(page.locator(".quick-photo h2")).toHaveText("An afternoon at home");
  // A refresh from another field must not silently advance the version of an already-open draft.
  await when.getByRole("button",{name:"Edit date",exact:true}).click();
  await when.getByLabel("Date",{exact:true}).fill("1985");
  const second=await page.context().newPage();
  await second.goto(`/quick-catalogue?archive=${archive}`);
  const secondWhen=second.getByRole("region",{name:"When",exact:true});
  await secondWhen.getByRole("button",{name:"Edit date",exact:true}).click();
  await secondWhen.getByLabel("Date",{exact:true}).fill("1986");
  await secondWhen.getByRole("button",{name:"Save date",exact:true}).click();
  await expect(secondWhen.getByRole("status")).toHaveText("Date saved.");
  await second.waitForLoadState("networkidle");await second.close();
  await caption.getByRole("button",{name:"Edit caption",exact:true}).click();
  await caption.getByRole("button",{name:"Save caption",exact:true}).click();
  await expect(when.getByText("c. 1986",{exact:true})).toBeVisible();
  await expect(when.getByLabel("Date",{exact:true})).toHaveValue("1985");
  await when.getByRole("button",{name:"Save date",exact:true}).click();
  await expect(when.getByRole("status")).toContainText("This field changed");
  expect((await summary()).items.find((i:{id:string})=>i.id===seed.ids[0]).reported_date).toBe("1986");
  await when.getByRole("button",{name:"Cancel",exact:true}).click();
  const conversation=page.getByRole("region",{name:"Family conversation",exact:true});
  await expect(conversation.getByText("Was this outside the house?",{exact:true})).toBeVisible();
  await expect(conversation.locator("article").first().getByRole("button",{name:"Edit your comment",exact:true})).toHaveCount(0);
  await conversation.getByLabel("Add a comment",{exact:true}).fill("I remember the dog was called Misha.");
  await conversation.getByRole("button",{name:"Post comment",exact:true}).click();
  await expect(conversation.getByText("I remember the dog was called Misha.",{exact:true})).toBeVisible();
  await expect(conversation.getByRole("status").filter({hasText:"Comment saved."})).toBeVisible();
  const ownId=(await summary()).comments.find((c:{body:string})=>c.body==="I remember the dog was called Misha.").id;
  const own=conversation.locator(`[data-comment-id="${ownId}"]`);
  await own.getByRole("button",{name:"Edit your comment",exact:true}).click();
  await own.getByRole("textbox",{name:"Edit your comment",exact:true}).fill("The dog was called Misha.");
  await own.getByRole("button",{name:"Save comment",exact:true}).click();
  await expect(conversation.getByText("The dog was called Misha.",{exact:true})).toBeVisible();
  await expect(conversation.getByText("· edited",{exact:true})).toBeVisible();
  const root=conversation.locator("article").filter({hasText:"Was this outside the house?"});
  await root.getByRole("button",{name:/Reply to/}).click();
  await conversation.getByLabel("Reply to an archive member",{exact:true}).fill("Yes, outside our house.");
  await conversation.getByRole("button",{name:"Post reply",exact:true}).click();
  await expect(conversation.locator(".comment-reply")).toHaveCount(1);
  await expect(conversation.locator(".comment-reply").getByRole("button",{name:/Reply to/})).toHaveCount(0);
  await own.getByText("Comment options",{exact:true}).click();
  await own.getByRole("button",{name:"Keep as a recollection",exact:true}).click();
  await expect(conversation.getByRole("status").filter({hasText:"Copied to recollections"})).toBeVisible();
  state=await summary();
  const ownRecord=state.comments.find((c:{body:string})=>c.body==="The dog was called Misha.");
  expect(ownRecord.author_id).toBe("60000000-0000-4000-8000-000000000003");
  expect(ownRecord.created_at).toBeTruthy();expect(ownRecord.edited_at).toBeTruthy();
  expect(state.recollections.find((r:{item_id:string})=>r.item_id===seed.ids[0]).original_text).toBe(ownRecord.body);
  await page.getByRole("button",{name:"Next needing information",exact:true}).click();
  await expect(page.locator(".quick-photo h2")).toHaveText("Quick photograph 2");
  await expect(page.getByRole("button",{name:"Previous",exact:true})).toBeEnabled();
  await page.getByRole("button",{name:"Previous",exact:true}).click();
  await expect(conversation.getByText("The dog was called Misha.",{exact:true})).toBeVisible();
  await page.waitForLoadState("networkidle"); // Finish the prior mutation refresh before measuring the next request.
  await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");
  await page.reload();await page.waitForLoadState("networkidle");
  const counts=await (await request.get("http://127.0.0.1:4301/__fixture/metrics")).json();
  expect(counts["/rest/v1/comments"]).toBe(1);
  expect(counts["/rest/v1/people"]).toBe(1);expect(counts["/rest/v1/places"]).toBe(1);
  expect(counts["/rest/v1/archive_memberships"]).toBe(1);
  expect(counts["/rest/v1/identifications"]).toBeLessThanOrEqual(3); // Archive links plus one visible-group read, never twelve reads.
  await page.getByRole("button",{name:"Choose photograph 12: Quick photograph 12",exact:true}).click();
  await page.getByRole("link",{name:"Next",exact:true}).click();
  await expect(page.locator(".quick-photo h2")).toHaveText("Quick photograph 13");
  await page.getByRole("button",{name:"Choose photograph 2: Quick photograph 14",exact:true}).click();
  await expect(page.locator(".quick-photo").getByText("Preview unavailable",{exact:true})).toBeVisible();
  await expect(page.locator(".quick-photo").getByText("Preparing display preview…",{exact:true})).toHaveCount(0);
  await page.getByRole("button",{name:"Previous",exact:true}).click();
  await page.getByRole("link",{name:"Previous",exact:true}).click();
  await expect(page.locator(".quick-photo h2")).toHaveText("An afternoon at home");
  await page.setViewportSize({width:375,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({path:"/private/tmp/quick-catalogue-mobile.png",fullPage:true});
  await page.getByRole("link",{name:"Open full record",exact:false}).click();
  await expect(page.getByRole("region",{name:"Family conversation",exact:true}).getByText("The dog was called Misha.",{exact:true})).toBeVisible();
  await expect(page.getByText("Archive information",{exact:true})).toBeVisible();
  await expect(page.getByText("Catalogue state",{exact:true})).not.toBeVisible();
  await page.getByText("Add a memory",{exact:true}).click();
  await expect(page.getByLabel("Add a recollection",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Account"}).click();
  await page.getByRole("button",{name:"Sign out",exact:true}).click();
  await expect(page).toHaveURL(/sign-in/);
  await page.goto(`/quick-catalogue?archive=${archive}`);
  await expect(page).toHaveURL(/sign-in/);
});

test("saved letters read as ordered objects with separate AI drafts, human review, translation and canonical confirmation",async({page,request})=>{
  test.setTimeout(120000);page.setDefaultTimeout(10000);
  const seed=await (await request.post("http://127.0.0.1:4301/__fixture/document-item")).json();
  const summary=async()=>(await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  await page.context().addCookies([{name:"active_archive",value:archive,url:"http://127.0.0.1:4300"}]);
  await page.goto("/sign-in?next="+encodeURIComponent(`/archive/${seed.id}`));
  await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");
  await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");
  await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();
  const reader=page.getByRole("region",{name:"Document pages",exact:true});
  await expect(reader.getByRole("navigation",{name:"Document page navigation"})).toContainText("Envelope front · 1 of 4");
  await reader.getByRole("button",{name:"Next page",exact:true}).click();
  await expect(reader.getByRole("navigation",{name:"Document page navigation"})).toContainText("Envelope back · 2 of 4");
  await reader.getByRole("button",{name:"Enlarge page",exact:true}).click();
  await expect(reader.getByRole("button",{name:"Fit page",exact:true})).toBeVisible();
  await page.reload();await expect(reader.getByRole("navigation",{name:"Document page navigation"})).toContainText("Envelope front · 1 of 4");
  const before=await summary();
  expect(before.files.filter((f:{item_id:string;purpose:string})=>f.item_id===seed.id&&f.purpose==="original")).toHaveLength(4);
  expect(before.identifications.filter((i:{item_id:string})=>i.item_id===seed.id)).toHaveLength(0);
  expect(before.itemPlaces.filter((i:{item_id:string})=>i.item_id===seed.id)).toHaveLength(0);
  await page.goto(`/explore?archive=${archive}&q=gazetteerreviewedphrase`);
  await expect(page.locator(".item-card").filter({hasText:"Fixture four-page letter"})).toHaveCount(0);
  await page.goto(`/archive/${seed.id}/review?run=${seed.runId}`);
  await expect(page.getByText("AI transcription is not configured.",{exact:false})).toBeVisible();
  await expect(page.getByRole("button",{name:"Transcribe again",exact:true})).toBeDisabled();
  const missing=await page.request.post(`/api/v1/documents/${seed.id}`,{headers:{origin:"http://127.0.0.1:4300"},data:{operation:"transcribe",requestId:crypto.randomUUID(),version:"fixture-document-v1"}});
  expect(missing.status()).toBe(503);expect((await missing.json()).error).toContain("not configured");
  const text=page.getByRole("region",{name:"Page transcription",exact:true});
  await expect(text.getByText("Cher Jan, Auroville, 17 August 1978. [unclear]",{exact:true})).toBeVisible();
  await text.getByRole("button",{name:"Correct this page",exact:true}).click();
  await text.getByLabel("Corrected transcription",{exact:true}).fill("Dear Jan, Auroville, 17 August 1978. gazetteerreviewedphrase");
  await text.getByRole("button",{name:"Save human correction",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Human correction saved"})).toBeVisible();
  await expect(text.getByText("Human-reviewed text",{exact:true})).toBeVisible();
  await text.getByRole("button",{name:"View original AI draft",exact:true}).click();
  await expect(text.getByText("Cher Jan, Auroville, 17 August 1978. [unclear]",{exact:true})).toBeVisible();
  await page.getByText("Advanced review",{exact:true}).click();
  const found=page.getByRole("region",{name:"AI suggestions",exact:true});
  const person=found.locator("article").filter({has:page.getByRole("checkbox",{name:"Review Jan",exact:true})});
  await expect(person.getByText("Possible existing Person: Jan Allen",{exact:false})).toBeVisible();
  await expect(person.getByRole("combobox",{name:"Match Jan",exact:true})).toHaveValue("");
  await person.getByRole("checkbox",{name:"Review Jan",exact:true}).check();
  await person.getByRole("combobox",{name:"Match Jan",exact:true}).selectOption(seed.person.id);
  const where=found.locator("article").filter({has:page.getByRole("checkbox",{name:"Review Auroville",exact:true})});
  await where.getByRole("checkbox",{name:"Review Auroville",exact:true}).check();
  await where.getByRole("combobox",{name:"Match Auroville",exact:true}).selectOption(seed.place.id);
  await found.getByRole("checkbox",{name:"Review 1978-08-17",exact:true}).check();
  await found.getByRole("checkbox",{name:"Review A letter about family travel.",exact:true}).check();
  await found.getByRole("button",{name:"Apply selected suggestions",exact:true}).click();
  await expect(found.getByRole("status")).toContainText("Selected suggestions reviewed");
  let state=await summary();
  expect(state.identifications.filter((i:{item_id:string})=>i.item_id===seed.id)).toMatchObject([{person_id:seed.person.id,status:"accepted",role_context:"mentioned"}]);
  expect(state.itemPlaces.filter((l:{item_id:string})=>l.item_id===seed.id)).toMatchObject([{place_id:seed.place.id,role:"written_in",status:"confirmed"}]);
  const sourcePage=state.documentTexts.find((t:{document_run_id:string;page_order_snapshot:number})=>t.document_run_id===seed.runId&&t.page_order_snapshot===0);
  expect(sourcePage.raw_ai_text).toBe("Cher Jan, Auroville, 17 August 1978. [unclear]");expect(sourcePage.review_revision).toBe(1);
  expect(state.items.find((i:{id:string})=>i.id===seed.id)).toMatchObject({reported_date:"1978-08-17",date_precision:"exact"});
  expect(state.people.filter((p:{id:string})=>p.id===seed.person.id)).toHaveLength(1);
  await page.goto(`/explore?archive=${archive}&q=gazetteerreviewedphrase`);
  await expect(page.locator(".item-card").filter({hasText:"Fixture four-page letter"})).toHaveCount(1);
  await page.goto(`/explore?archive=${archive}&place=${seed.place.id}`);
  await expect(page.locator(".item-card").filter({hasText:"Fixture four-page letter"})).toHaveCount(1);
  await page.goto(`/archive/${seed.id}/review?run=${seed.translationId}`);
  await expect(page.getByRole("region",{name:"Page transcription"}).getByText("English draft page 1; source remains separate.",{exact:true})).toBeVisible();
  await expect(page.getByRole("region",{name:"Review what AI found",exact:true})).toHaveCount(0);
  await page.getByText("Processing history",{exact:true}).click();
  await expect(page.getByRole("link",{name:/transcribe.*fixture.*synthetic-document-v1/})).toBeVisible();
  await page.getByText("Source text used for this translation",{exact:true}).click();
  await expect(page.getByText("Cher Jan, Auroville, 17 August 1978. [unclear]",{exact:true})).toBeVisible();
  await page.goto(`/archive/${seed.id}/review?run=${seed.runId}`);
  await page.getByText("Arrange document pages",{exact:true}).click();
  await page.getByRole("button",{name:"Review page order",exact:true}).click();
  await page.getByRole("button",{name:"Move document page 4 earlier",exact:true}).click();
  await page.getByRole("button",{name:"Save page order",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Page order saved"})).toBeVisible();
  await expect(page.getByText("The page sequence changed after this attempt.",{exact:false})).toBeVisible();
  state=await summary();
  const originals=state.files.filter((f:{item_id:string;purpose:string})=>f.item_id===seed.id&&f.purpose==="original").sort((a:{page_order:number},b:{page_order:number})=>a.page_order-b.page_order);
  expect(originals.map((f:{id:string})=>f.id)).toEqual([seed.sourceIds[0],seed.sourceIds[1],seed.sourceIds[3],seed.sourceIds[2]]);
  expect(state.documentRuns.find((r:{id:string})=>r.id===seed.runId).source_manifest.map((p:{id:string})=>p.id)).toEqual(seed.sourceIds);
  for(const f of originals){expect(f.sha256).toBe(before.originalHash);const response=await page.request.get(`/api/v1/files/${f.id}`);expect(createHash("sha256").update(await response.body()).digest("hex")).toBe(before.originalHash);}
  await page.setViewportSize({width:375,height:850});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await page.screenshot({path:"/private/tmp/document-review-mobile.png",fullPage:true});
  await page.goto(`/archive/${seed.id}`);await expect(page.getByText("A letter about family travel.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Account"}).click();await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/sign-in/);
  expect((await page.request.post(`/api/v1/documents/${seed.id}`)).status()).toBe(401);
});

test("family conversation is reachable from cards and persisted presentation rotation follows every private image surface",async({page,request})=>{
  test.setTimeout(120000);page.setDefaultTimeout(10000);
  const seed=await(await request.post("http://127.0.0.1:4301/__fixture/quick-photos")).json();
  const summary=async()=>(await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  await page.route("**/*",route=>{const h=route.request().headers();return h["next-router-prefetch"]==="1"||h.purpose==="prefetch"?route.abort():route.continue();});
  await page.context().addCookies([{name:"active_archive",value:archive,url:"http://127.0.0.1:4300"}]);
  await page.goto("/sign-in?next="+encodeURIComponent(`/archive/${seed.ids[0]}`));
  await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();
  const before=await summary();const original=before.files.find((f:{item_id:string;purpose:string})=>f.item_id===seed.ids[0]&&f.purpose==="original");
  const image=page.locator(".saved-original").first();
  await page.locator(".image-options summary").first().click();
  await page.getByRole("button",{name:"Rotate right",exact:true}).click();
  await expect(page.getByRole("status").filter({hasText:"Image rotated"})).toBeVisible();
  await expect(image).toHaveAttribute("data-presentation-rotation","90");
  await expect(image.locator(".image-presentation")).toHaveCSS("transform",/^matrix\(0, 1, -1, 0,/);
  await expect(image.locator(".image-presentation")).toHaveCSS("background-image",/data:image\/webp/);
  await page.reload();await expect(image).toHaveAttribute("data-presentation-rotation","90");
  await page.locator(".image-options summary").first().click();
  await page.getByRole("button",{name:"Rotate left",exact:true}).click();await expect(image).toHaveAttribute("data-presentation-rotation","0");
  for(const angle of [90,180,270,0]){await page.getByRole("button",{name:"Rotate right",exact:true}).click();await expect(image).toHaveAttribute("data-presentation-rotation",String(angle));}
  await page.getByRole("button",{name:"Rotate right",exact:true}).click();await expect(image).toHaveAttribute("data-presentation-rotation","90");
  const conversation=page.getByRole("region",{name:"Family conversation",exact:true});
  await expect(conversation).toBeVisible();await conversation.getByLabel("Add a comment",{exact:true}).fill("I recognise this doorway.");await conversation.getByRole("button",{name:"Post comment",exact:true}).click();await expect(conversation.getByText("I recognise this doorway.",{exact:true})).toBeVisible();
  await conversation.getByRole("button",{name:"Reply to Test contributor",exact:true}).click();await conversation.getByRole("textbox",{name:"Reply to Test contributor",exact:true}).fill("Yes, the family home.");await conversation.getByRole("button",{name:"Post reply",exact:true}).click();await expect(conversation.getByText("Yes, the family home.",{exact:true})).toBeVisible();
  const person=seed.people.find((p:{display_name:string})=>p.display_name==="03 No material"),who=page.getByRole("region",{name:"People in this item",exact:true});
  await who.getByRole("button",{name:"+ Add person",exact:true}).click();await who.getByLabel("Search People in this archive").fill(person.display_name);await who.getByRole("list",{name:"Matching People"}).getByRole("button").first().click();await expect(who.getByRole("status")).toHaveText("Person saved.");
  const where=page.getByRole("region",{name:"Places in this item",exact:true});await where.getByRole("button",{name:"+ Add place",exact:true}).click();await where.getByLabel("Search Places in this archive").fill("Rotation family home");await where.getByRole("button",{name:"+ Add new place",exact:true}).click();await where.getByRole("button",{name:"Create Place and link to this item",exact:true}).click();await expect(where.getByRole("status")).toHaveText("Place saved.");
  await page.goto(`/explore?archive=${archive}`);await expect(page.getByRole("link",{name:"Quick catalogue ↗",exact:true})).toBeVisible();
  const card=page.locator(".item-card").filter({has:page.locator(`a[href*="${seed.ids[0]}"]`)});
  await expect(card.locator(".archive-image")).toHaveAttribute("data-presentation-rotation","90");await expect(card.getByRole("button",{name:/3 comments on/})).toBeVisible();
  await card.getByRole("button",{name:/3 comments on/}).click();await expect(page).toHaveURL(/\/explore\?/);await expect(card.getByText("I recognise this doorway.",{exact:true})).toBeVisible();
  await page.goto(`/quick-catalogue?archive=${archive}`);await expect(page.locator(".quick-photo .archive-image")).toHaveAttribute("data-presentation-rotation","90");
  await page.setViewportSize({width:375,height:850});expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);await page.screenshot({path:"/private/tmp/rotation-quick-mobile.png",fullPage:true});
  // Pin the fixture's rotated item as the visit anchor while retaining random live selection.
  const homeState=await summary();
  const readyIds=homeState.items.filter((i:{id:string;archived_at?:string;kind:string})=>!i.archived_at&&i.kind!=="Audio"&&homeState.imageSets.some((s:{item_id:string;status:string})=>s.item_id===i.id&&s.status==="stored")).map((i:{id:string})=>i.id);
  let visit="";
  for(let n=0;n<100000;n++){
    const candidate=`00000000-0000-4000-8000-${n.toString(16).padStart(12,"0")}`;
    const ranked=[...readyIds].sort((a:string,b:string)=>homeVisitHash(`${archive}:${candidate}:${a}`)-homeVisitHash(`${archive}:${candidate}:${b}`));
    if(ranked[0]===seed.ids[0]){visit=candidate;break;}
  }
  expect(visit).not.toBe("");await page.context().addCookies([{name:HOME_VISIT_COOKIE,value:visit,url:"http://127.0.0.1:4300"}]);
  await page.goto("/");await expect(page.getByRole("link",{name:"Help identify photographs ↗",exact:true})).toBeVisible();
  const piece=page.locator(".scrapbook-piece").filter({has:page.locator(`a[href*="${seed.ids[0]}"]`)});await expect(piece.locator(".archive-image")).toHaveAttribute("data-presentation-rotation","90");await expect(piece.getByRole("button",{name:/3 comments on/})).toBeVisible();
  await page.waitForLoadState("networkidle");await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");await page.reload();await page.waitForLoadState("networkidle");const metrics=await(await request.get("http://127.0.0.1:4301/__fixture/metrics")).json();expect(metrics["/rest/v1/item_conversation_counts"]).toBe(1);expect(metrics["/rest/v1/comments"]||0).toBe(0);
  await page.goto(`/people?archive=${archive}`);await expect(page.locator(`.material-leaf[data-item-id="${seed.ids[0]}"] .archive-image`).first()).toHaveAttribute("data-presentation-rotation","90");
  await page.goto(`/places?archive=${archive}`);await expect(page.locator(`.material-leaf[data-item-id="${seed.ids[0]}"] .archive-image`).first()).toHaveAttribute("data-presentation-rotation","90");
  const after=await summary();const stored=after.files.find((f:{id:string})=>f.id===original.id);expect(stored.sha256).toBe(original.sha256);expect(stored.storage_path).toBe(original.storage_path);expect(after.imageSets.filter((s:{original_file_id:string})=>s.original_file_id===original.id)).toEqual(before.imageSets.filter((s:{original_file_id:string})=>s.original_file_id===original.id));
  const bytes=await page.request.get(`/api/v1/files/${original.id}`);expect(createHash("sha256").update(await bytes.body()).digest("hex")).toBe(original.sha256);
  await page.getByRole("button",{name:"Account"}).click();await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page).toHaveURL(/sign-in/);
  await page.goto("/sign-in?next="+encodeURIComponent(`/archive/${seed.ids[0]}`));await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();await expect(image).toHaveAttribute("data-presentation-rotation","90");
});

test("Explore lazily opens one inline family conversation, posts and edits locally, and keeps browsing position",async({page,request})=>{
  test.setTimeout(120000);page.setDefaultTimeout(10000);
  const seed=await(await request.post("http://127.0.0.1:4301/__fixture/quick-photos")).json();
  await page.context().addCookies([{name:"active_archive",value:archive,url:"http://127.0.0.1:4300"}]);
  await page.route("**/*",route=>{const h=route.request().headers();return h["next-router-prefetch"]==="1"||h.purpose==="prefetch"?route.abort():route.continue();});
  await page.goto("/sign-in?next="+encodeURIComponent(`/explore?archive=${archive}`));await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();
  const card=(id:string)=>page.locator(".item-card").filter({has:page.locator(`a[href*="${id}"]`)});
  const metrics=async()=>(await request.get("http://127.0.0.1:4301/__fixture/metrics")).json();
  await page.waitForLoadState("networkidle");await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");await page.reload();await page.waitForLoadState("networkidle");
  let counts=await metrics();expect(counts["/rest/v1/comments"]||0).toBe(0);expect(counts["/rest/v1/item_conversation_counts"]).toBe(1);
  const first=card(seed.ids[0]),empty=card(seed.ids[1]);
  await expect(first.getByRole("button",{name:/1 comment on/})).toBeVisible();await expect(empty.getByRole("button",{name:/Add a comment on/})).toBeVisible();
  await expect(page.getByRole("region",{name:"Family conversation",exact:true})).toHaveCount(0);
  const address=page.url();await first.getByRole("button",{name:/1 comment on/}).focus();await first.getByRole("button",{name:/1 comment on/}).press("Enter");
  const thread=first.getByRole("region",{name:"Family conversation",exact:true});await expect(thread.getByText("Was this outside the house?",{exact:true})).toBeVisible();expect(page.url()).toBe(address);
  counts=await metrics();expect(counts["/rest/v1/comments"]).toBe(1);const catalogueReads=counts["/rest/v1/archive_items"];
  const state=await(await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  const reads=state.conversationRequests;expect(reads).toHaveLength(1);expect(reads[0].query).toContain(`item_id=eq.${seed.ids[0]}`);
  await expect(thread.getByRole("button",{name:"Edit your comment",exact:true})).toHaveCount(0);
  await thread.getByLabel("Add a comment",{exact:true}).fill("Inline family knowledge.");
  const renders=await page.evaluate(()=>{const value=crypto.randomUUID();(window as unknown as {inlineMarker:string}).inlineMarker=value;return value;});
  await thread.getByRole("button",{name:"Post comment",exact:true}).click();await expect(thread.getByText("Inline family knowledge.",{exact:true})).toBeVisible();await expect(thread.getByLabel("Add a comment",{exact:true})).toHaveValue("");
  expect(page.url()).toBe(address);expect(await page.evaluate(()=>(window as unknown as {inlineMarker:string}).inlineMarker)).toBe(renders);
  // Mutations return their saved row; no workspace refresh, page re-render or full-thread reload is needed.
  counts=await metrics();expect(counts["/rest/v1/archive_items"]).toBe(catalogueReads);
  await thread.getByRole("button",{name:"Reply to Test contributor",exact:true}).click();
  const own=thread.locator(".family-comment").filter({has:page.getByText("Inline family knowledge.",{exact:true})}).first();
  await expect(own.getByRole("textbox",{name:"Reply to Test contributor",exact:true})).toBeFocused();await own.getByRole("textbox",{name:"Reply to Test contributor",exact:true}).fill("A reply beneath its photograph.");await own.getByRole("button",{name:"Post reply",exact:true}).click();await expect(thread.locator(".comment-reply").getByText("A reply beneath its photograph.",{exact:true})).toBeVisible();
  await expect(first.getByRole("button",{name:/Hide conversation on/})).toContainText("3 comments");
  await own.getByRole("button",{name:"Edit your comment",exact:true}).click();await own.getByLabel("Edit your comment",{exact:true}).fill("Inline corrected knowledge.");await own.getByRole("button",{name:"Save comment",exact:true}).click();await expect(thread.getByText("Inline corrected knowledge.",{exact:true})).toBeVisible();
  await thread.getByLabel("Add a comment",{exact:true}).fill("Unsent words stay here.");
  await first.getByRole("button",{name:/Hide conversation on/}).click();await expect(first.getByRole("button",{name:/3 comments on/})).toBeVisible();
  const before=await metrics();await first.getByRole("button",{name:/3 comments on/}).click();await expect(thread.getByText("Inline corrected knowledge.",{exact:true})).toBeVisible();await expect(thread.getByLabel("Add a comment",{exact:true})).toHaveValue("Unsent words stay here.");counts=await metrics();expect(counts["/rest/v1/comments"]).toBe(before["/rest/v1/comments"]);
  await first.getByRole("button",{name:/Hide conversation on/}).click();
  await page.setViewportSize({width:375,height:850});await empty.getByRole("button",{name:/Add a comment on/}).scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);
  await empty.getByRole("button",{name:/Add a comment on/}).click();expect(Math.abs(await page.evaluate(()=>scrollY)-y)).toBeLessThan(90);const small=empty.getByRole("region",{name:"Family conversation",exact:true});await small.getByLabel("Add a comment",{exact:true}).fill("A phone comment.");await small.getByRole("button",{name:"Post comment",exact:true}).click();await expect(small.getByText("A phone comment.",{exact:true})).toBeVisible();await expect(small.getByLabel("Add a comment",{exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);await empty.screenshot({path:"/private/tmp/inline-conversation-mobile-card.png"});
  await empty.getByRole("button",{name:/Hide conversation on/}).scrollIntoViewIfNeeded();const collapseY=await page.evaluate(()=>scrollY);
  await empty.getByRole("button",{name:/Hide conversation on/}).click();await expect(empty.getByRole("button",{name:/1 comment on/})).toBeVisible();expect(Math.abs(await page.evaluate(()=>scrollY)-collapseY)).toBeLessThan(90);expect(page.url()).toBe(address);
  const after=await(await request.get("http://127.0.0.1:4301/__fixture/summary")).json();expect(after.recollections.filter((r:{item_id:string})=>seed.ids.includes(r.item_id))).toHaveLength(0);
  expect((await page.request.get(`/api/v1/conversations/${seed.ids[0]}?archive=60000000-0000-4000-8000-000000000099`)).status()).toBe(404);
});

test("a preserved photograph can be reclassified as a Letter and open existing document processing without re-upload",async({page,request})=>{
 test.setTimeout(120000);page.setDefaultTimeout(10000);
 const seed=await(await request.post("http://127.0.0.1:4301/__fixture/quick-photos")).json();
 const summary=async()=>(await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
 await page.context().addCookies([{name:"active_archive",value:archive,url:"http://127.0.0.1:4300"}]);
 await page.goto("/sign-in?next="+encodeURIComponent(`/archive/${seed.ids[0]}`));await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();
 await expect(page.getByRole("region",{name:"Document transcription",exact:true})).toHaveCount(0);
 const before=await summary(),prior=before.items.find((i:{id:string})=>i.id===seed.ids[0]);
 await page.getByText("Change item type",{exact:true}).click();await page.getByLabel("Archive item type",{exact:true}).selectOption("Letter");await page.getByRole("button",{name:"Save item type",exact:true}).click();
 const actions=page.getByRole("region",{name:"Document transcription",exact:true});await expect(actions.getByRole("link",{name:"Transcribe letter",exact:true})).toBeVisible();await expect(page.getByRole("region",{name:"Document pages",exact:true})).toBeVisible();
 expect(await page.getByRole("region",{name:"Document pages",exact:true}).evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('[aria-label="Document transcription"]')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
 let after=await summary();const next=after.items.find((i:{id:string})=>i.id===seed.ids[0]);expect(next.kind).toBe("Letter");
 for(const key of ["title","reported_date","date_precision","reported_place","people_text","notes","id"])expect(next[key]).toBe(prior[key]);
 for(const name of ["files","comments","identifications","itemPlaces","recollections","imageSets"])expect(after[name].filter((r:{item_id:string})=>r.item_id===seed.ids[0])).toEqual(before[name].filter((r:{item_id:string})=>r.item_id===seed.ids[0]));
 const original=after.files.find((f:{item_id:string;purpose:string})=>f.item_id===seed.ids[0]&&f.purpose==="original");const bytes=await page.request.get(`/api/v1/files/${original.id}`);expect(createHash("sha256").update(await bytes.body()).digest("hex")).toBe(original.sha256);
 await actions.getByRole("link",{name:"Transcribe letter",exact:true}).click();await expect(page.getByRole("button",{name:"Transcribe letter",exact:true})).toBeDisabled();await expect(page.getByText("AI transcription is not configured.",{exact:false})).toBeVisible();
 await page.goto(`/archive/${seed.ids[0]}`);await page.getByText("Change item type",{exact:true}).click();await page.getByLabel("Archive item type",{exact:true}).selectOption("Document");await page.getByRole("button",{name:"Save item type",exact:true}).click();await expect(actions.getByRole("link",{name:"Transcribe document",exact:true})).toBeVisible();
 await page.reload();await expect(actions.getByRole("link",{name:"Transcribe document",exact:true})).toBeVisible();
 await page.goto("/add");
 for(const name of ["Take photo","Choose from library"]){
  await expect(page.getByRole("button",{name,exact:true})).toBeEnabled();
  const chooser=page.waitForEvent("filechooser");await page.getByRole("button",{name,exact:true}).click();await chooser;
 }
 await page.getByLabel("Upload existing images",{exact:true}).setInputFiles(["public/images/letter.jpg","public/images/beach.jpg"]);
 await page.getByLabel("Material type",{exact:true}).selectOption("Postcard");await expect(page.locator(".capture-page")).toHaveCount(2);await expect(page.getByRole("combobox",{name:"Role for letter.jpg",exact:true})).toContainText("Written side");

 after=await summary();expect(after.items).toHaveLength(before.items.length);
});

test("correspondence review links a sender, keeps a recipient as reviewed text and bounds private page prefetch",async({page,request})=>{
 test.setTimeout(120000);page.setDefaultTimeout(10000);
 const seed=await(await request.post("http://127.0.0.1:4301/__fixture/document-item?correspondence=1&pages=12")).json();
 const summary=async()=>(await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
 const metrics=async()=>(await request.get("http://127.0.0.1:4301/__fixture/metrics")).json();
 const before=await summary(),sets=before.imageSets.filter((g:{item_id:string})=>g.item_id===seed.id);
 const urls=seed.sourceIds.map((id:string)=>`/api/v1/assets/${sets.find((g:{original_file_id:string})=>g.original_file_id===id).thumbnail_file_id}`);
 const highRequests:string[]=[],allRequests:string[]=[];
 page.on("request",r=>{const path=new URL(r.url()).pathname;allRequests.push(path);if(urls.includes(path))highRequests.push(path);});
 await page.context().addCookies([{name:"active_archive",value:archive,url:"http://127.0.0.1:4300"}]);
 await page.goto("/sign-in?next="+encodeURIComponent(`/archive/${seed.id}`));await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();
 const reader=page.getByRole("region",{name:"Document pages",exact:true});
 await expect(page.locator("h1")).toHaveText("Letter");
 const read=page.getByRole("link",{name:"Read transcription",exact:true});await expect(read).toHaveClass(/button/);
 await expect.poll(()=>highRequests.includes(urls[1])).toBe(true);
 expect(highRequests.filter(url=>urls.slice(2).includes(url))).toEqual([]);
 await reader.locator(".document-page img:visible").evaluate(img=>(img as HTMLImageElement).decode());
 const initialMetrics=await metrics();
 await reader.getByRole("button",{name:"Next page",exact:true}).click();await reader.locator(".document-page img:visible").evaluate(img=>(img as HTMLImageElement).decode());
 await expect.poll(()=>highRequests.includes(urls[2])).toBe(true);
 await reader.getByRole("button",{name:"Previous page",exact:true}).click();
 await reader.locator(".document-page img:visible").evaluate(img=>(img as HTMLImageElement).decode());
 expect(highRequests.filter(url=>url===urls[0])).toHaveLength(1);expect(highRequests.filter(url=>url===urls[1])).toHaveLength(1);
 expect(highRequests.filter(url=>urls.slice(3).includes(url))).toEqual([]);
 expect(await reader.locator("[data-document-source]").count()).toBeLessThanOrEqual(3);
 const afterNav=await metrics();expect(afterNav["/rest/v1/transcriptions"]).toBe(initialMetrics["/rest/v1/transcriptions"]);
 expect(allRequests.filter(url=>url.startsWith("/api/v1/files/"))).toEqual([]);
 const derivative=await page.request.get(urls[0]);expect(derivative.headers()["cache-control"]).toBe("private, no-cache, must-revalidate");
 const before304=await metrics();const conditional=await page.request.get(urls[0],{headers:{"if-none-match":derivative.headers().etag}});expect(conditional.status()).toBe(304);
 const after304=await metrics();expect(Object.entries(after304).filter(([key])=>key.startsWith("/storage/"))).toEqual(Object.entries(before304).filter(([key])=>key.startsWith("/storage/")));
 const fallback=await page.request.get(`/api/v1/previews/${seed.sourceIds[0]}`);expect(fallback.status()).toBe(200);expect(fallback.headers().etag).toBeTruthy();expect(fallback.headers()["cache-control"]).toBe("private, no-cache, must-revalidate");
 const fallbackBefore=await metrics();const cached=await page.request.get(`/api/v1/previews/${seed.sourceIds[0]}`,{headers:{"if-none-match":fallback.headers().etag}});expect(cached.status()).toBe(304);expect(cached.headers()["cache-control"]).toBe("private, no-cache, must-revalidate");
 expect(cached.headers().vary).toContain("Cookie");const fallbackAfter=await metrics();expect(Object.entries(fallbackAfter).filter(([key])=>key.startsWith("/storage/"))).toEqual(Object.entries(fallbackBefore).filter(([key])=>key.startsWith("/storage/")));
 await read.click();
 const concise=page.getByRole("region",{name:"Review what AI found",exact:true});await expect(concise).toBeVisible();
 await expect(page.getByRole("checkbox",{name:"Review Jan",exact:true})).not.toBeVisible();
 const from=concise.getByRole("region",{name:"From",exact:true});await from.getByRole("button",{name:"Change",exact:true}).click();await from.getByLabel("Link Jan Allen",{exact:true}).selectOption(seed.person.id);await from.getByRole("button",{name:"Confirm",exact:true}).click();await expect(from.getByText("Human reviewed",{exact:true})).toBeVisible();
 const to=concise.getByRole("region",{name:"To",exact:true});await to.getByRole("button",{name:"Confirm",exact:true}).click();await expect(to.getByText("Human reviewed",{exact:true})).toBeVisible();
 const date=concise.getByRole("region",{name:"Date",exact:true});await date.getByRole("button",{name:"Confirm",exact:true}).click();await expect(date.getByText("Human reviewed",{exact:true})).toBeVisible();await expect(date.getByText("17 August 1978",{exact:true})).toBeVisible();
 const place=concise.getByRole("region",{name:"Place",exact:true});await place.getByRole("button",{name:"Change",exact:true}).click();await place.getByLabel("Link Auroville",{exact:true}).selectOption(seed.place.id);await place.getByRole("button",{name:"Confirm",exact:true}).click();await expect(place.getByText("Human reviewed",{exact:true})).toBeVisible();
 await page.getByText("Advanced review",{exact:true}).click();await expect(page.getByRole("region",{name:"AI suggestions",exact:true}).getByRole("checkbox",{name:"Review Jan",exact:true})).toBeVisible();
 await expect(page.locator(".document-review-grid")).toBeVisible();
 const after=await summary();expect(after.people).toHaveLength(before.people.length);
 expect(after.identifications.filter((i:{item_id:string})=>i.item_id===seed.id)).toMatchObject([{person_id:seed.person.id,role_context:"sender",status:"accepted"}]);
 expect(after.documentSuggestions.find((s:{item_id:string;field_path:string})=>s.item_id===seed.id&&s.field_path==="document.recipient")).toMatchObject({status:"accepted",reviewed_value:{value:"Tina",text_only:true,canonical_id:""}});
 await page.goto(`/archive/${seed.id}`);await expect(page.locator("h1")).toHaveText("Letter from Jan Allen to Tina, 1978");
 const header=page.getByRole("region",{name:"Correspondence",exact:true});await expect(header.getByRole("link",{name:"Jan Allen",exact:true})).toBeVisible();await expect(header).toContainText("Tina");await expect(header).toContainText("17 August 1978");await expect(header).toContainText("Auroville");
 expect(after.items.find((i:{id:string})=>i.id===seed.id).title).toBe("Letter, still to be catalogued");
 await page.setViewportSize({width:375,height:850});await page.getByRole("link",{name:"Read transcription",exact:true}).click();
 await expect(page.locator("h1")).toHaveText("Letter from Jan Allen to Tina, 1978");
 await expect(page.getByRole("region",{name:"Page transcription",exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
 await page.screenshot({path:"/private/tmp/letter-correspondence-mobile.png",fullPage:true});
 const original=await page.request.get(`/api/v1/files/${seed.sourceIds[0]}`);expect(createHash("sha256").update(await original.body()).digest("hex")).toBe(before.originalHash);
 const anonymous=await request.get(`http://127.0.0.1:4300${urls[0]}`,{headers:{"if-none-match":derivative.headers().etag}});expect(anonymous.status()).toBe(401);
 expect((await page.request.get("/api/v1/assets/60000000-0000-4000-8000-000000009999",{headers:{"if-none-match":derivative.headers().etag}})).status()).toBe(404);
});

test.describe("site-wide phone audit",()=>{
 let phoneCookies:Awaited<ReturnType<import("@playwright/test").BrowserContext["cookies"]>>;
 let routes:string[],letterId:string,runId:string,photoId:string;
 const bounds=async(page:import("@playwright/test").Page)=>{
  const result=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
  expect(result.document,`${page.url()} width ${result.viewport}`).toBeLessThanOrEqual(result.viewport);
 };
 const hit=async(locator:import("@playwright/test").Locator)=>{
  const box=await locator.boundingBox();expect(box).not.toBeNull();expect(box!.width).toBeGreaterThanOrEqual(43);expect(box!.height).toBeGreaterThanOrEqual(43);
 };
 test.beforeAll(async({browser,request})=>{
  const context=await browser.newContext({baseURL:"http://127.0.0.1:4300"});
  await context.addCookies([{name:"active_archive",value:archive,url:"http://127.0.0.1:4300"}]);const page=await context.newPage();
  await page.goto("/sign-in?next=%2Fadd");await page.getByLabel("Email",{exact:true}).fill("visibility@example.test");await page.getByLabel("Password",{exact:true}).fill("local-fixture-password");await page.locator("form").getByRole("button",{name:"Sign in",exact:true}).click();await page.waitForURL(url=>url.pathname==="/add");
  const initial=await(await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  if(!initial.imageSets.some((s:{status:string})=>s.status==="stored"))expect((await page.request.post(`/api/v1/previews/${sources[0]}`,{headers:{origin:"http://127.0.0.1:4300"}})).ok()).toBe(true);
  const doc=await(await request.post("http://127.0.0.1:4301/__fixture/document-item?correspondence=1")).json();letterId=doc.id;runId=doc.runId;
  const people=await(await request.post("http://127.0.0.1:4301/__fixture/people-material")).json();
  const places=await(await request.post("http://127.0.0.1:4301/__fixture/places-material")).json();
  const photos=await(await request.post("http://127.0.0.1:4301/__fixture/quick-photos")).json();photoId=photos.ids[0];
  routes=["/","/explore","/quick-catalogue","/people",`/people/${people.people[0].id}`,"/places",`/places/${places.places[0].id}`,`/archive/${photoId}`,`/archive/${people.materialIds[4]}`,`/archive/${letterId}`,`/archive/${letterId}/review?run=${runId}`,"/add","/add/voice","/admin","/admin/settings","/admin/members","/admin/invitations","/admin/processing",`/archive/${letterId}/edit`];
  phoneCookies=await context.cookies();await context.close();
 });
 for(const width of [320,360,375,390,430,768,1024,1440])test(`responsive ${width}px: routes, expanded controls, text and paper stay contained`,async({page})=>{
  test.setTimeout(180000);await page.context().addCookies(phoneCookies);await page.setViewportSize({width,height:844});
  for(const route of routes){await page.goto(route);await page.locator("h1").waitFor();await page.evaluate(()=>document.fonts.ready);await bounds(page);}
  await page.goto("/");
  for(const selector of [".header-actions .icon-button:visible",".header-actions .add-button:visible",".header-actions .avatar:visible"])for(const control of await page.locator(selector).all())await hit(control);
  await page.locator(".archive-current-name").evaluate(e=>e.textContent="The Allen & Cork Family History Archive");
  const name=await page.locator(".archive-current-name").evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,rect:e.getBoundingClientRect().toJSON()}));expect(name.scroll).toBeLessThanOrEqual(name.height+1);expect(name.rect.x).toBeGreaterThanOrEqual(0);expect(name.rect.right).toBeLessThanOrEqual(width);
  await page.getByRole("button",{name:"Account"}).click();const panel=await page.locator(".profile-panel").boundingBox();expect(panel!.x).toBeGreaterThanOrEqual(0);expect(panel!.x+panel!.width).toBeLessThanOrEqual(width);await bounds(page);await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Account"})).toBeFocused();
  await expect(page.getByRole("navigation",{name:"Mobile navigation",exact:true})).toHaveCount(0);
  if(width<=820){
   const primary=page.getByRole("navigation",{name:"Primary mobile navigation",exact:true});
   for(const label of ["Home","Explore","Add","People"])await hit(primary.getByRole("link",{name:label,exact:true}));
   await page.getByRole("button",{name:"Open menu",exact:true}).click();await expect(page.getByRole("navigation",{name:"Mobile navigation",exact:true})).toBeVisible();await bounds(page);await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Open menu",exact:true})).toBeFocused();
  }
  await page.getByLabel("Current archive: Test archive",{exact:true}).click();await bounds(page);await page.keyboard.press("Escape");
  await page.locator(".scrapbook-piece .archive-image").evaluateAll(es=>es.forEach(e=>(e as HTMLElement).style.aspectRatio="0.06"));await bounds(page);
  const geometry=await page.locator(".scrapbook-piece > .archive-image").first().evaluate(e=>({transform:getComputedStyle(e).transform,height:e.getBoundingClientRect().height}));expect(geometry.transform).not.toBe("none");expect(geometry.height).toBeLessThan(600);
  await page.goto("/");await page.locator(".home-scrapbook .archive-image img").first().evaluate(img=>(img as HTMLImageElement).decode());
  for(const caption of await page.locator(".scrapbook-caption").all())expect(await caption.evaluate(e=>getComputedStyle(e).transform)).toBe("none");
  await page.screenshot({path:`/private/tmp/allen-cork-visual-refresh/home-${width}.png`,fullPage:true});
  if(width===375||width===1440){
   await page.screenshot({path:`/private/tmp/allen-cork-visual-refresh/home-first-screen-${width}.png`});
   await page.goto("/explore");await expect(page.locator(".explore-page")).toBeVisible();await page.locator(".item-card img").first().evaluate(img=>(img as HTMLImageElement).decode());await page.screenshot({path:`/private/tmp/allen-cork-visual-refresh/explore-${width}.png`});
   await page.goto("/people");await expect(page.locator(".archival-people-grid")).toBeVisible();await page.locator(".material-leaf img").first().evaluate(img=>(img as HTMLImageElement).decode());await page.screenshot({path:`/private/tmp/allen-cork-visual-refresh/people-${width}.png`});
  }
  for(const route of ["/","/explore"]){await page.goto(route);await page.locator("h1").waitFor();await page.evaluate(()=>document.documentElement.style.fontSize="24px");await bounds(page);}
  // The existing phone input/body minima and compact controls below apply at <=600px.
  // Larger widths retain their desktop fields and are covered by the workflow tests above.
  if(width>600)return;
  await page.goto(`/explore?archive=${archive}&q=${encodeURIComponent("Quick photograph")}`);
  const card=page.locator(".item-card").first();await card.getByRole("button",{name:/comments on|comment on/}).click();const conversation=card.getByRole("region",{name:"Family conversation",exact:true});await expect(conversation).toBeVisible();
  const textarea=conversation.getByLabel("Add a comment",{exact:true});expect(await textarea.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  await page.setViewportSize({width,height:440});await textarea.fill("Phone width "+width+": "+"a-long-family-memory-".repeat(8));await textarea.focus();await bounds(page);
  await hit(conversation.getByRole("button",{name:"Post comment",exact:true}));await conversation.getByRole("button",{name:"Post comment",exact:true}).click();await expect(textarea).toBeFocused();await bounds(page);
  const comment=conversation.locator(".family-comment").filter({hasText:"Phone width "+width});await expect(comment).toBeVisible();expect(await comment.locator(".comment-body").evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  await hit(comment.getByRole("button",{name:/^Reply to/}));await comment.getByRole("button",{name:/^Reply to/}).click();await bounds(page);
  await page.setViewportSize({width,height:844});
  await page.goto(`/archive/${photoId}`);
  expect(await page.getByRole("region",{name:"People in this item",exact:true}).evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('.saved-context .family-conversation')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.getByText("Image options",{exact:true}).click();await hit(page.getByRole("button",{name:"Rotate left",exact:true}));await hit(page.getByRole("button",{name:"Rotate right",exact:true}));await bounds(page);
  await page.goto("/people");for(const metadata of await page.locator(".person-card .person-meta span").all())expect(await metadata.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
  await page.goto("/quick-catalogue");expect(await page.getByRole("link",{name:/Back to Explore/}).evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);await hit(page.getByRole("navigation",{name:"Photograph navigation",exact:true}).getByRole("button",{name:"Next",exact:true}));await bounds(page);
  await page.goto(`/archive/${letterId}/review?run=${runId}`);await page.getByText("Advanced review",{exact:true}).click();await bounds(page);
  for(const control of await page.locator(".document-suggestion input:not([type=checkbox]),.document-suggestion select").all())expect(await control.evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(16);
  if(width===375){expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);await page.screenshot({path:"/private/tmp/mobile-review-375.png",fullPage:true});}
  await page.goto("/add");await page.getByLabel("Upload existing images",{exact:true}).setInputFiles(["public/images/letter.jpg","public/images/beach.jpg"]);await page.getByLabel("Material type",{exact:true}).selectOption("Letter");await page.getByText("Add a note or details (optional)",{exact:true}).click();await bounds(page);
  if(width===375)expect((await new AxeBuilder({page}).withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
  await page.evaluate(()=>document.documentElement.style.fontSize="24px");await bounds(page);expect(await page.getByLabel("Material type",{exact:true}).evaluate(e=>parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(24);
 });
 test("Retina gallery uses a correctly sized private derivative; desktop composition is retained",async({browser,page})=>{
  const context=await browser.newContext({baseURL:"http://127.0.0.1:4300",viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});await context.addCookies(phoneCookies);const phone=await context.newPage();
  await phone.goto(`/explore?archive=${archive}&q=Quick%20photograph`);const image=phone.locator(".item-card img[data-image-variant=thumbnail]").first();await expect(image).toBeVisible();await image.evaluate(img=>(img as HTMLImageElement).decode());await expect(image).toHaveAttribute("sizes",/90vw/);
  const current=await image.evaluate(img=>(img as HTMLImageElement).currentSrc);const summary=await(await phone.request.get("http://127.0.0.1:4301/__fixture/summary")).json();expect(summary.imageSets.some((s:{thumbnail_file_id:string;manifest:{thumbnail:{width:number}}})=>current.endsWith(s.thumbnail_file_id)&&s.manifest.thumbnail.width>=1000)).toBe(true);await bounds(phone);await context.close();
  await page.context().addCookies(phoneCookies);await page.setViewportSize({width:1440,height:960});await page.goto("/");await expect(page.locator(".home-scrapbook")).toBeVisible();await bounds(page);
  expect(await page.locator(".home-scrapbook").evaluate(e=>getComputedStyle(e).display)).toBe("flex");
  expect(await page.locator(".scrapbook-piece").first().evaluate(e=>getComputedStyle(e).transform)).toBe("none");expect(await page.locator(".scrapbook-piece > .archive-image").first().evaluate(e=>getComputedStyle(e).transform)).not.toBe("none");expect((await page.locator(".site-header").boundingBox())!.height).toBe(111);
  await page.goto("/explore");await expect(page.locator(".conversation-grid")).toBeVisible();expect(await page.locator(".conversation-grid").evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(" ").length)).toBe(4);await bounds(page);
 });
});
