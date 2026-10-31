import { Worker } from "node:worker_threads";
import path from "node:path";
import { BackendError } from "../backend/errors";
let running = false;
export async function convertPreview(
  source: Uint8Array,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (running)
    throw new BackendError(
      429,
      "Another preview is being prepared. Try again shortly.",
    );
  running = true;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(
        path.join(process.cwd(), "scripts/preview-worker.cjs"),
        { workerData: source, resourceLimits: { maxOldGenerationSizeMb: 256 } },
      );
      const fail = () =>
        reject(
          new BackendError(
            422,
            "This preview could not be prepared. The original is preserved; you can retry later.",
          ),
        );
      const timer = setTimeout(() => {
        void worker.terminate();
        fail();
      }, 45000);
      worker.once("message", (result) => {
        clearTimeout(timer);
        void worker.terminate();
        if (result.error) fail();
        else resolve(result);
      });
      worker.once("error", () => {
        clearTimeout(timer);
        fail();
      });
      worker.once("exit", () => {
        clearTimeout(timer);
        fail(); // A posted result has already settled; reject silent exits.
      });
    });
  } finally {
    running = false;
  }
}
