import { test, expect } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadAudio } from "../src/lib/audio/upload";
import {
  audioChecksum,
  emptyAudioMetadata,
  validateAudioBytes,
} from "../src/lib/audio/validation";
import { inspectAudio } from "../src/lib/audio/server-validation";
import { audioRange } from "../src/lib/audio/range";
function wave() {
  const b = Buffer.alloc(44 + 1600);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(16000, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(1600, 40);
  return new Uint8Array(b);
}
const archiveId = "40000000-0000-4000-8000-000000000001",
  captureId = "40000000-0000-4000-8000-000000000002";
function fake(allowed = true) {
  let file: Record<string, unknown> | undefined;
  const objects = new Map<string, Uint8Array>();
  let creates = 0;
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe("begin_audio_recording");
      if (!allowed) return { data: null, error: { code: "42501" } };
      if (!file) {
        creates++;
        const source = args.p_file as Record<string, unknown>;
        file = {
          id: "file-id",
          original_file_id: "file-id",
          mime_type: source.mimeType,
          sha256: source.sha256,
          byte_size: source.size,
          status: "reserved",
          bucket_id: "archive-audio",
          storage_path: `${archiveId}/item/opaque`,
        };
      }
      return { data: "recording-id", error: null };
    },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        single: async () => ({ data: file, error: null }),
      };
      return query;
    },
    storage: {
      from: () => ({
        upload: async (
          path: string,
          bytes: Uint8Array,
          options: { upsert: boolean },
        ) => {
          expect(options.upsert).toBe(false);
          if (objects.has(path)) return { error: { message: "exists" } };
          objects.set(path, bytes.slice());
          return { error: null };
        },
        download: async (path: string) => ({
          data: objects.has(path)
            ? new Blob([objects.get(path)! as Uint8Array<ArrayBuffer>])
            : null,
          error: null,
        }),
      }),
    },
  };
  return {
    client: client as unknown as SupabaseClient,
    objects,
    get creates() {
      return creates;
    },
  };
}
test("audio validation recognises actual WAV, preserves bytes and reports duration", async () => {
  const bytes = wave(),
    hash = await audioChecksum(bytes);
  expect(validateAudioBytes(bytes, "audio/wav")).toBe("audio/wav");
  expect(await inspectAudio(bytes, "audio/wav")).toBe(100);
  expect(await audioChecksum(bytes)).toBe(hash);
});
test("invalid or mismatched audio is rejected on client and server", async () => {
  expect(() =>
    validateAudioBytes(new Uint8Array([1, 2, 3]), "audio/mpeg"),
  ).toThrow();
  expect(() => validateAudioBytes(wave(), "audio/mp4")).toThrow();
  await expect(
    inspectAudio(
      new TextEncoder().encode("ID3junk metadata without any audio"),
      "audio/mpeg",
    ),
  ).rejects.toMatchObject({ status: 400 });
});
test("authorised upload reserves one original, retries incomplete receipts and never overwrites bytes", async () => {
  const state = fake();
  const bytes = wave();
  const input = {
    archiveId,
    captureId,
    file: new File([bytes], "voice.wav", { type: "audio/wav" }),
    metadata: emptyAudioMetadata,
    people: [],
    items: [],
  };
  let fail = true;
  const finish = async () => {
    if (fail) throw new Error("receipt interrupted");
    return { itemId: "item-id" };
  };
  await expect(uploadAudio(state.client, input, finish)).rejects.toThrow(
    "receipt interrupted",
  );
  fail = false;
  expect((await uploadAudio(state.client, input, finish)).itemId).toBe(
    "item-id",
  );
  expect(state.creates).toBe(1);
  expect(state.objects.size).toBe(1);
  expect([...state.objects.values()][0]).toEqual(bytes);
  const changed = wave();
  changed[100] = 12;
  await expect(
    uploadAudio(
      state.client,
      {
        ...input,
        file: new File([changed], "voice.wav", { type: "audio/wav" }),
      },
      finish,
    ),
  ).rejects.toMatchObject({ status: 409 });
  expect([...state.objects.values()][0]).toEqual(bytes);
});
test("denied audio reservation uploads no source bytes", async () => {
  const state = fake(false);
  await expect(
    uploadAudio(
      state.client,
      {
        archiveId,
        captureId,
        file: new File([wave()], "voice.wav", { type: "audio/wav" }),
        metadata: emptyAudioMetadata,
        people: [],
        items: [],
      },
      async () => ({ itemId: "never" }),
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(state.objects.size).toBe(0);
});
test("single ranges validate seek offsets without exposing unrelated bytes", () => {
  expect(audioRange("bytes=2-5", 10)).toEqual({ start: 2, end: 5 });
  expect(audioRange("bytes=-3", 10)).toEqual({ start: 7, end: 9 });
  expect(audioRange("bytes=4-", 10)).toEqual({ start: 4, end: 9 });
  expect(audioRange("bytes=20-", 10)).toBe(false);
  expect(audioRange("bytes=0-1,4-5", 10)).toBe(false);
  expect(audioRange(null, 10)).toBeNull();
});
