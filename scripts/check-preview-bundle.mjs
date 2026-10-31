// Execute only the production trace's files in a disposable directory, with no repo module fallback.
import {
  readFile,
  mkdtemp,
  mkdir,
  copyFile,
  lstat,
  readlink,
  symlink,
  rm,
} from "node:fs/promises";
import { join, resolve, relative, dirname } from "node:path";
import { tmpdir } from "node:os";
import { Worker } from "node:worker_threads";
import assert from "node:assert/strict";
export async function checkPreviewBundle(dist, fixture) {
  const project = process.cwd();
  const tracePath = resolve(
    dist,
    "server/app/api/v1/previews/[id]/route.js.nft.json",
  );
  const trace = JSON.parse(await readFile(tracePath, "utf8"));
  const directory = await mkdtemp(join(tmpdir(), "archive-preview-bundle-"));
  try {
    let worker;
    for (const file of trace.files) {
      const source = resolve(dirname(tracePath), file);
      const local = relative(project, source);
      assert(
        !local.startsWith("..") && !local.includes(".env"),
        "Unexpected trace boundary",
      );
      const target = join(directory, local);
      await mkdir(dirname(target), { recursive: true });
      const info = await lstat(source);
      if (info.isSymbolicLink()) await symlink(await readlink(source), target);
      else if (info.isFile()) await copyFile(source, target);
      if (
        local.includes("[worker thread]-scripts_preview-worker") &&
        local.endsWith(".js")
      )
        worker = target;
    }
    assert(worker, "Production trace must include the decoder worker chunk");
    const result = await new Promise((resolve, reject) => {
      const thread = new Worker(worker, {
        workerData: { source: new Uint8Array(fixture) },
      });
      const timer = setTimeout(() => {
        void thread.terminate();
        reject(new Error("Traced decoder timed out"));
      }, 35000);
      thread.once("message", (value) => {
        clearTimeout(timer);
        void thread.terminate();
        resolve(value);
      });
      thread.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    assert(!result.error, `Traced decoder failed: ${result.error}`);
    assert(result.bytes.length > 0 && result.width > 0 && result.height > 0);
    console.log(
      `Isolated production trace passed: ${result.width}×${result.height} JPEG, ${result.bytes.length} bytes.`,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
