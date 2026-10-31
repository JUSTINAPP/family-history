"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { prepareDisplay } from "@/lib/preview/client";
import { FileImage } from "lucide-react";
export function ArchiveImage({
  src,
  alt,
  className = "",
  priority = false,
  position,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  position?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const local = src.startsWith("blob:");
  const derived = src.startsWith("/api/v1/previews/");
  const attempted = useRef(new Set<string>());
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!derived || failedSrc !== src || attempted.current.has(src)) return;
    attempted.current.add(src);
    let active = true;
    void prepareDisplay(src)
      .then(() => {
        if (active) {
          setFailedSrc(null);
          setRevision((n) => n + 1);
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [derived, failedSrc, src]);
  return (
    <div className={`archive-image ${className}`}>
      {failedSrc === src ? (
        <div className="image-unavailable">
          <FileImage size={22} strokeWidth={1} />
          <span role="status">
            {derived
              ? message || "Preparing display preview…"
              : "Image preview unavailable"}
          </span>
          <small>
            {local ? "Original file still selected" : "Original preserved"}
          </small>
          {derived && message && (
            <button
              className="subtle-button"
              onClick={(event) => {
                event.preventDefault();
                setMessage("");
                void prepareDisplay(src, true)
                  .then(() => {
                    setFailedSrc(null);
                    setRevision((n) => n + 1);
                  })
                  .catch((error) => setMessage(error.message));
              }}
            >
              Retry preview
            </button>
          )}
        </div>
      ) : (
        <Image
          src={derived ? `${src}?v=${revision}` : src}
          alt={alt}
          fill
          sizes="(max-width: 600px) 95vw, (max-width: 1000px) 48vw, 40vw"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          unoptimized={local || src.startsWith("/api/v1/")}
          onError={() => {
            if (derived && attempted.current.has(src))
              setMessage(
                "Preview could not be displayed. Original preserved; retry when connected.",
              );
            setFailedSrc(src);
          }}
          style={{ objectFit: "cover", objectPosition: position }}
        />
      )}
    </div>
  );
}
