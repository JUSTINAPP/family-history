import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistUpload } from "../src/lib/backend/upload-core";
import { BackendError } from "../src/lib/backend/errors";
const archive = "10000000-0000-4000-8000-000000000001";
const item = "10000000-0000-4000-8000-000000000002";
const capture = "10000000-0000-4000-8000-000000000003";
const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
function form(source = bytes) {
  const form = new FormData();
  form.set("archiveId", archive);
  form.set("captureId", capture);
  form.set("title", "A source");
  form.set("context", "A recollection in my own words.");
  form.set("kind", "Photograph");
  form.set("quick", '{"precision":"unknown"}');
  form.set("roles", '["image"]');
  form.append(
    "files",
    new File([new Uint8Array(source)], "unsafe/name.png", {
      type: "image/png",
    }),
  );
  return form;
}
function backend({
  allowed = true,
  failComplete = false,
  wrongHash = false,
} = {}) {
  const objects = new Map<string, Buffer>();
  let reserved: Record<string, unknown>[] = [];
  let begins = 0;
  let attempts = 0;
  let completed = 0;
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "can_access_archive") return { data: allowed, error: null };
      if (name === "begin_ingestion") {
        if (!reserved.length) {
          begins++;
          const manifest = args.p_files as Record<string, unknown>[];
          reserved = manifest.map((m, i) => ({
            id: `file-${i}`,
            purpose: "original",
            kind: args.p_kind,
            page_order: i,
            archive_id: archive,
            item_id: item,
            bucket_id: "archive-originals",
            storage_path: `${archive}/${item}/opaque-${i}`,
            sha256: wrongHash ? "b".repeat(64) : m.sha256,
            byte_size: m.size,
            mime_type: m.mimeType,
          }));
        }
        return { data: item, error: null };
      }
      if (name === "complete_ingestion") {
        attempts++;
        if (failComplete && attempts === 1)
          return { data: null, error: { message: "temporary failure" } };
        completed++;
        return { data: null, error: null };
      }
      throw new Error("Unexpected RPC");
    },
    from: () => {
      const filters: [string, unknown][] = [];
      const query = {
        select: () => query,
        eq: (field: string, value: unknown) => {
          filters.push([field, value]);
          return query;
        },
        order: async () => ({
          data: reserved.filter((row) =>
            filters.every(([field, value]) => row[field] === value),
          ),
          error: null,
        }),
      };
      return query;
    },
    storage: {
      from: () => ({
        upload: async (
          path: string,
          body: Buffer,
          options: { upsert: boolean },
        ) => {
          expect(options.upsert).toBe(false);
          if (objects.has(path))
            return { error: { message: "already exists" } };
          objects.set(path, Buffer.from(body));
          return { error: null };
        },
        download: async (path: string) => ({
          data: objects.has(path)
            ? new Blob([new Uint8Array(objects.get(path)!)])
            : null,
          error: objects.has(path) ? null : { message: "not found" },
        }),
      }),
    },
  };
  return {
    client: client as unknown as SupabaseClient,
    objects,
    get reserved() {
      return reserved;
    },
    get begins() {
      return begins;
    },
    get completed() {
      return completed;
    },
  };
}
test("upload core preserves exact source bytes, original hash and idempotent reservations", async () => {
  const fake = backend();
  expect((await persistUpload(fake.client, form())).id).toBe(item);
  await persistUpload(fake.client, form());
  expect(fake.begins).toBe(1);
  expect(fake.objects.size).toBe(1);
  expect([...fake.objects.values()][0].equals(bytes)).toBe(true);
  expect(fake.reserved[0].sha256).toBe(
    createHash("sha256").update(bytes).digest("hex"),
  );
  expect(fake.reserved[0].storage_path).not.toContain("unsafe");
});
test("a failed receipt can retry without replacing already-preserved originals", async () => {
  const fake = backend({ failComplete: true });
  await expect(persistUpload(fake.client, form())).rejects.toBeInstanceOf(
    BackendError,
  );
  expect(fake.objects.size).toBe(1);
  await persistUpload(fake.client, form());
  expect(fake.begins).toBe(1);
  expect(fake.objects.size).toBe(1);
  expect(fake.completed).toBe(1);
  expect([...fake.objects.values()][0].equals(bytes)).toBe(true);
});
test("permission denial and disguised non-images fail before source upload", async () => {
  const denied = backend({ allowed: false });
  await expect(persistUpload(denied.client, form())).rejects.toMatchObject({
    status: 403,
  });
  expect(denied.objects.size).toBe(0);
  const fake = backend();
  await expect(
    persistUpload(fake.client, form(Buffer.from("<svg/>"))),
  ).rejects.toMatchObject({ status: 400 });
  expect(fake.begins).toBe(0);
  expect(fake.objects.size).toBe(0);
});
test("changed retry hashes are rejected without overwriting an existing reservation", async () => {
  const fake = backend({ wrongHash: true });
  await expect(persistUpload(fake.client, form())).rejects.toMatchObject({
    status: 409,
  });
  expect(fake.objects.size).toBe(0);
});

for(const count of [1,2,4])test(`${count}-page letter remains one item with ordered independently preserved original bytes`,async()=>{
  const fake=backend();const input=form();input.set("kind","Letter");input.set("context","");input.delete("files");
  const originals=Array.from({length:count},(_,n)=>Buffer.from([...bytes,n]));
  input.set("roles",JSON.stringify(Array.from({length:count},(_,n)=>n===0?"envelope-front":n===1?"envelope-back":"page")));
  originals.forEach((body,n)=>input.append("files",new File([new Uint8Array(body)],`letter-${n}.png`,{type:"image/png"})));
  const saved=await persistUpload(fake.client,input);
  expect(saved.id).toBe(item);expect(fake.begins).toBe(1);expect(fake.objects.size).toBe(count);
  fake.reserved.forEach((row,n)=>{
    expect(row.item_id).toBe(item);expect(row.kind).toBe("Letter");expect(row.page_order).toBe(n);
    expect(row.sha256).toBe(createHash("sha256").update(originals[n]).digest("hex"));
    expect(fake.objects.get(String(row.storage_path))).toEqual(originals[n]);
  });
  await persistUpload(fake.client,input);expect(fake.begins).toBe(1);expect(fake.objects.size).toBe(count);
});
