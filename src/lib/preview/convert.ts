import { Worker } from "node:worker_threads";
import path from "node:path";
import { BackendError } from "../backend/errors";
let running = false;
export class PreviewConversionError extends BackendError {
  constructor(
    public code: string,
    status = 422,
  ) {
    super(
      status,
      `Preview could not be prepared (${code}). Original preserved; retry is available.`,
    );
  }
}
export async function convertPreview(
  source: Uint8Array,
  timeoutMs = 35000,
): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  if (running) throw new PreviewConversionError("decoder_busy", 429);
  if (!source.length || source.length > 30 * 1024 * 1024)
    throw new PreviewConversionError("source_size_limit");
  running = true;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(
        path.join(process.cwd(), "scripts/preview-worker.cjs"),
        // Turbopack augments workerData via object spread. A bare Uint8Array loses its
        // prototype/length in production; a named property survives structured cloning.
        {
          workerData: { source },
          resourceLimits: { maxOldGenerationSizeMb: 256 },
        },
      );
      const fail = (code: string) => reject(new PreviewConversionError(code));
      const timer = setTimeout(
        () => {
          void worker.terminate();
          fail("decode_timeout");
        },
        Math.min(35000, timeoutMs),
      );
      worker.once("message", (result) => {
        clearTimeout(timer);
        void worker.terminate();
        if (result.error) {
          fail(result.error);
        } else resolve(result);
      });
      worker.once("error", (error: Error & { code?: string }) => {
        clearTimeout(timer);
        fail(
          error.code === "MODULE_NOT_FOUND"
            ? "decoder_dependency_missing"
            : "decoder_worker_failed",
        );
      });
      worker.once("exit", () => {
        clearTimeout(timer);
        fail("decoder_worker_exited"); // A posted result has already settled; reject silent exits.
      });
    });
  } finally {
    running = false;
  }
}
