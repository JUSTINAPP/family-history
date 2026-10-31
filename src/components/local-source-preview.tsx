"use client";
import { useEffect, useState } from "react";
import { ArchiveImage } from "./archive-image";
const cache = new WeakMap<File, Promise<Blob>>();
let queue: Promise<unknown> = Promise.resolve();
export function localHeicPreview(file: File): Promise<Blob> {
  const existing = cache.get(file);
  if (existing) return existing;
  const task = queue
    .catch(() => {})
    .then(
      () =>
        new Promise<Blob>((resolve, reject) => {
          const worker = new Worker("/heic-preview-worker.js");
          const timer = setTimeout(() => {
            worker.terminate();
            reject(new Error("timeout"));
          }, 45000);
          const finish = () => {
            clearTimeout(timer);
            worker.terminate();
          };
          worker.onmessage = ({ data }) => {
            finish();
            if (data.blob) resolve(data.blob);
            else reject(new Error("preview"));
          };
          worker.onerror = () => {
            finish();
            reject(new Error("preview"));
          };
          void file
            .arrayBuffer()
            .then((bytes) => worker.postMessage(bytes, [bytes]))
            .catch(() => {
              finish();
              reject(new Error("preview"));
            });
        }),
    );
  queue = task;
  cache.set(file, task);
  return task;
}
export function LocalSourcePreview({
  file,
  url,
  alt,
}: {
  file: File;
  url: string;
  alt: string;
}) {
  const heic =
    /\.(heic|heif)$/i.test(file.name) || /image\/hei[cf]/.test(file.type);
  const [result, setResult] = useState<{
    file: File;
    url?: string;
    failed?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!heic) return;
    let active = true,
      generated: string | undefined;
    void localHeicPreview(file)
      .then((blob) => {
        if (active) {
          generated = URL.createObjectURL(blob);
          setResult({ file, url: generated });
        }
      })
      .catch(() => {
        if (active) setResult({ file, failed: true });
      });
    return () => {
      active = false;
      if (generated) URL.revokeObjectURL(generated);
    };
  }, [file, heic]);
  if (!heic) return <ArchiveImage src={url} alt={alt} />;
  const current = result?.file === file ? result : null;
  return current?.url ? (
    <ArchiveImage src={current.url} alt={alt} />
  ) : (
    <div className="archive-image">
      <div className="image-unavailable" role="status">
        <span>
          {current?.failed
            ? "Preview will be retried after import"
            : "Preparing image preview…"}
        </span>
        <small>Original file selected unchanged</small>
      </div>
    </div>
  );
}
