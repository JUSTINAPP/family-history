"use client";
import Image from "next/image";
import { useState } from "react";
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
  return (
    <div className={`archive-image ${className}`}>
      {failedSrc === src && local ? (
        <div className="image-unavailable">
          <FileImage size={22} strokeWidth={1} />
          <span>Preview unavailable</span>
          <small>Original file still selected</small>
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 600px) 95vw, (max-width: 1000px) 48vw, 40vw"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          unoptimized={local || src.startsWith("/api/v1/files/")}
          onError={() => {
            if (local) setFailedSrc(src);
          }}
          style={{ objectFit: "cover", objectPosition: position }}
        />
      )}
    </div>
  );
}
