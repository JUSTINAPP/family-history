"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { prepareDisplay } from "@/lib/preview/client";
import { assetUrl, type ImageSet } from "@/lib/preview/types";
import { FileImage } from "lucide-react";
export function ArchiveImage({
  src,
  alt,
  className = "",
  priority = false,
  position,
  href,
  originalPreserved,
  imageSet: suppliedSet,
  variant: requestedVariant = "display",
  sizes,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
  position?: string;
  href?: string;
  originalPreserved?: boolean;
  imageSet?: ImageSet;
  variant?: "thumbnail" | "display";
  sizes?: string;
}) {
  const variant = src.includes("variant=thumbnail")
    ? "thumbnail"
    : requestedVariant;
  const [failed, setFailed] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<{
    source: string;
    set: ImageSet;
    base: ImageSet | undefined;
  } | null>(null);
  const [loaded, setLoaded] = useState("");
  const set =
    prepared?.source === src && prepared.base === suppliedSet
      ? prepared.set
      : suppliedSet;
  const primary = set ? set[variant] : null;
  const delivery = primary
    ? assetUrl(primary.id)
    : src.startsWith("/api/v1/previews/")
      ? `${src.split("?")[0]}?variant=${variant}&v=${revision}`
      : src;
  const candidates = set
    ? variant === "thumbnail"
      ? [set.small, set.thumbnail]
      : [set.small, set.thumbnail, set.display]
    : [];
  const byWidth = new Map(candidates.map((v) => [v.width, v]));
  const srcSet = [...byWidth.values()]
    .sort((a, b) => a.width - b.width)
    .map((v) => `${assetUrl(v.id)} ${v.width}w`)
    .join(", ");
  const attempted = useRef(new Set<string>()),
    derived = src.startsWith("/api/v1/previews/"),
    local = src.startsWith("blob:");
  useEffect(() => {
    if (!derived || failed !== src || attempted.current.has(src)) return;
    attempted.current.add(src);
    let active = true;
    void prepareDisplay(src)
      .then((result) => {
        if (active) {
          if (result)
            setPrepared({ source: src, set: result, base: suppliedSet });
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
  }, [derived, failed, src, suppliedSet]);
  async function retry() {
    setBusy(true);
    setMessage("");
    try {
      const result = await prepareDisplay(src, true);
      if (result) setPrepared({ source: src, set: result, base: suppliedSet });
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
    <div
      className={`archive-image ${className} ${set ? "has-placeholder" : ""}`}
      style={
        set
          ? {
              backgroundImage: `url("${set.placeholder}")`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              aspectRatio: `${set[variant].width}/${set[variant].height}`,
              height: "auto",
            }
          : undefined
      }
    >
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
          {derived && message && <small>{message}</small>}
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
          {derived && set ? (
            // Authenticated responsive variants are already optimized; bypass Next's shared optimizer cache.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={(node) => {
                if (node?.complete && node.naturalWidth > 0)
                  queueMicrotask(() => setLoaded(delivery));
              }}
              src={delivery}
              srcSet={srcSet}
              sizes={
                sizes ||
                (variant === "thumbnail"
                  ? "(max-width: 820px) 44vw, (max-width: 1100px) 29vw, (max-width: 1800px) 22vw, 385px"
                  : "(max-width: 820px) 90vw, (max-width: 1800px) 48vw, 850px")
              }
              alt={alt}
              width={primary!.width}
              height={primary!.height}
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
              onLoad={() => setLoaded(delivery)}
              onError={() => {
                setMessage(
                  "Image delivery failed. Original preserved; retry when connected.",
                );
                setFailed(src);
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: position,
                opacity: loaded === delivery ? 1 : 0,
                transition: "opacity 180ms ease",
              }}
            />
          ) : (
            <Image
              src={delivery}
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
          )}
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
