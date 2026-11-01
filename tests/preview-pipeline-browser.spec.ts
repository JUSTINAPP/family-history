import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import sharp from "sharp";
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
  await expect(page.locator(".item-card .has-placeholder")).toHaveCSS(
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
  await page.getByRole("button", { name: "Demo profile" }).click();
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
  await page
    .getByRole("combobox", { name: "Item type", exact: true })
    .selectOption("Photograph");
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
  await expect(many.locator(".has-placeholder").first()).toHaveCSS(
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
  expect(cached.status()).toBe(304);
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
    page.getByRole("heading", { name: "A sense of place.", exact: true }),
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
  await expect(cards.first().locator(".has-placeholder").first()).toHaveCSS(
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

test("home is a deterministic private scrapbook using real small variants and working material links", async ({page, request}) => {
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
  await expect(pieces).toHaveCount(9);
  const state = await (await request.get("http://127.0.0.1:4301/__fixture/summary")).json();
  const smallIds = new Set(state.imageSets.map((s: {small_file_id: string}) => s.small_file_id));
  const links = await pieces.locator(".scrapbook-caption").evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
  for (const link of links) expect(state.items.some((i: {id: string; archived_at?: string}) => link?.includes(i.id) && !i.archived_at)).toBe(true);
  await expect(pieces.first().locator(".has-placeholder")).toHaveCSS("background-image", /data:image\/webp/);
  await expect(pieces.last().locator("img")).toHaveAttribute("loading", "lazy");
  await expect(pieces.first().locator("img")).toHaveAttribute("data-image-variant", "small");
  await expect(pieces.first().locator("img")).not.toHaveAttribute("srcset");
  await request.get("http://127.0.0.1:4301/__fixture/metrics?reset=1");
  await page.reload();
  await expect(pieces).toHaveCount(9);
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
  await page.setViewportSize({width: 375, height: 850});
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await pieces.last().scrollIntoViewIfNeeded();
  await expect.poll(() => pieces.last().locator("img").evaluate(n => (n as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({path: "/private/tmp/scrapbook-mobile.png", fullPage: true});
  await page.setViewportSize({width: 1440, height: 1000});
  await page.screenshot({path: "/private/tmp/scrapbook-desktop.png", fullPage: true});
  for (const url of images) {
    expect(url).toContain("/api/v1/assets/");
    expect(smallIds.has(new URL(url).pathname.split("/").pop())).toBe(true);
  }
  await pieces.first().locator(".scrapbook-caption").click();
  await expect(page).toHaveURL(new RegExp(links[0]!.split("?")[0]));
  await expect(page.locator(".saved-original")).not.toHaveCount(0);
});
