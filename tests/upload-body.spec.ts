import { test, expect } from "@playwright/test";
import { readUploadForm } from "../src/lib/backend/multipart";

test("multipart transport preserves fields and original bytes", async () => {
  const form = new FormData();
  const bytes = new Uint8Array([0, 255, 10, 13]);
  form.set("context", "Original words");
  form.set("files", new File([bytes], "source.png", { type: "image/png" }));
  const parsed = await readUploadForm(
    new Request("http://localhost/upload", { method: "POST", body: form }),
  );
  expect(parsed.get("context")).toBe("Original words");
  expect(new Uint8Array(await (parsed.get("files") as File).arrayBuffer())).toEqual(bytes);
});

test("oversized chunked bodies are cancelled without Content-Length", async () => {
  let cancelled = false;
  const chunk = new Uint8Array(3 * 1024 * 1024);
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  });
  const request = new Request("http://localhost/upload", {
    method: "POST",
    headers: { "Content-Type": "multipart/form-data; boundary=example" },
    body,
    duplex: "half",
  } as RequestInit);
  await expect(readUploadForm(request)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
});
