"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { prepareDisplay } from "@/lib/preview/client";
import { FileImage } from "lucide-react";
export function ArchiveImage({
  src,
  alt,
  className = "",
  priority = false,
  position,
  href,
  originalPreserved,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  position?: string;
  href?: string;
  originalPreserved?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const attempted = useRef(new Set<string>()),
    derived = src.startsWith("/api/v1/previews/"),
    local = src.startsWith("blob:");
  useEffect(() => {
    if (!derived || failed !== src || attempted.current.has(src)) return;
    attempted.current.add(src);
    let active = true;
    void prepareDisplay(src)
      .then(() => {
        if (active) {
          setFailed(null);
          setRevision((n) => n + 1);
        }
      })
      .catch((error) => {
        if (active) setMessage(error.message);
      });
    return () => {
      active = false;
    };
  }, [derived, failed, src]);
  async function retry() {
    setBusy(true);
    setMessage("");
    try {
      await prepareDisplay(src, true);
      setFailed(null);
      setRevision((n) => n + 1);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Please retry later.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`archive-image ${className}`}>
      {failed === src ? (
        <div className="image-unavailable">
          <FileImage size={22} strokeWidth={1} />
          <span role="status">
            {derived && !message
              ? "Preparing display preview…"
              : "Preview unavailable"}
          </span>
          <small>
            {local
              ? "Original file still selected"
              : originalPreserved
                ? "Original safely preserved"
                : "The item is still available"}
          </small>
          {href && (
            <Link className="text-link" href={href}>
              Open item ↗
            </Link>
          )}
          {derived && message && (
            <button
              type="button"
              className="subtle-button"
              disabled={busy}
              onClick={retry}
            >
              {busy ? "Preparing preview…" : "Retry preview"}
            </button>
          )}
        </div>
      ) : (
        <PreviewLink href={href}>
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
              setFailed(src);
            }}
            style={{ objectFit: "cover", objectPosition: position }}
          />
        </PreviewLink>
      )}
    </div>
  );
}
function PreviewLink({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  return href ? (
    <Link
      prefetch={false}
      href={href}
      style={{ position: "absolute", inset: 0 }}
    >
      {children}
    </Link>
  ) : (
    <>{children}</>
  );
}
