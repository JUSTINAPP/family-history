import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { inspectAudio } from "../src/lib/audio/server-validation";

test("browser microphone records, pauses, resumes, previews and deletes without uploading", async ({
  page,
}) => {
  let uploads = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /supabase|\/api\/v1\//.test(request.url())
    )
      uploads++;
  });
  await page.addInitScript(() => {
    const fixture = window as typeof window & {
      encodedBytes?: number;
      toneSource?: {
        context: AudioContext;
        tone: OscillatorNode;
        output: MediaStreamAudioDestinationNode;
      };
    };
    const NativeRecorder = window.MediaRecorder;
    window.MediaRecorder = class extends NativeRecorder {
      constructor(stream: MediaStream, options?: MediaRecorderOptions) {
        super(stream, options);
        fixture.encodedBytes = 0;
        this.addEventListener("dataavailable", (event) => {
          fixture.encodedBytes = (fixture.encodedBytes || 0) + event.data.size;
        });
      }
    };
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const tone = context.createOscillator();
      const output = context.createMediaStreamDestination();
      tone.connect(output);
      tone.start();
      fixture.toneSource = { context, tone, output };
      await context.resume();
      return output.stream;
    };
  });
  await page.goto("/add/voice");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/Recording · 0:0[1-9]/, {
    timeout: 10000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as typeof window & { encodedBytes?: number })
              .encodedBytes || 0,
        ),
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Paused");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  const player = page.getByLabel("Preview selected audio");
  await expect(player).toBeVisible();
  const source = await player.getAttribute("src");
  expect(source).toMatch(/^blob:/);
  const bytes = await page.evaluate(
    async (url) =>
      Array.from(new Uint8Array(await (await fetch(url!)).arrayBuffer())),
    source,
  );
  expect(
    await inspectAudio(new Uint8Array(bytes), "audio/webm"),
  ).not.toBeUndefined();
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Delete / start again" }).click();
  await expect(player).toHaveCount(0);
  expect(uploads).toBe(0);
});
test("microphone denial keeps the audio upload alternative usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
  });
  await page.goto("/add/voice");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Microphone access was not available" }),
  ).toBeVisible();
  await expect(page.getByLabel("Upload audio recording")).toBeEnabled();
});
test("audio upload preview is private/local, optional metadata works and mobile layout stays accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto("/add/voice");
  await page
    .getByLabel("Upload audio recording")
    .setInputFiles("public/audio/example-recollection.wav");
  await expect(page.getByLabel("Preview selected audio")).toBeVisible();
  await page
    .getByText("Add names, dates or context (optional)", { exact: true })
    .click();
  await page
    .getByLabel("Tags (comma separated)", { exact: true })
    .pressSequentially("memory, interview");
  await expect(
    page.getByLabel("Tags (comma separated)", { exact: true }),
  ).toHaveValue("memory, interview");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
