"use client";
import { useEffect, useRef, useState } from "react";
import { prepareDisplay } from "@/lib/preview/client";
import type { ImageSet } from "@/lib/preview/types";
import { presentationRatio } from "@/lib/preview/types";
import { ArchiveImage } from "./archive-image";
import type { StackMaterial } from "@/lib/people-material";
export function PersonMaterialStack({
  items,
  count,
  name,
}: {
  items: StackMaterial[];
  count: number;
  name: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [prepared, setPrepared] = useState<Record<string, ImageSet>>({});
  const sources = items.filter(item => !item.imageSet && item.image.startsWith("/api/v1/previews/")).map(item => item.image).join("|");
  useEffect(() => {
    if (!sources || !frame.current) return;
    let active = true;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      for (const source of sources.split("|")) void prepareDisplay(source).then(set => {
        if (active && set) setPrepared(old => ({...old, [source]: set}));
      }).catch(() => {});
    }, { rootMargin: "300px" });
    observer.observe(frame.current);
    return () => { active = false; observer.disconnect(); };
  }, [sources]);
  const material = items.map(item => ({...item, imageSet: item.imageSet || prepared[item.image]}));
  return (
    <div
      ref={frame}
      className={`person-material-stack stack-${items.length}`}
      data-material-count={items.length}
    >
      {items.length ? (
        material.map((item, index) => (
          <div
            className={`material-leaf leaf-${index} material-${item.kind.toLowerCase()}`}
            key={item.id}
            data-item-id={item.id}
            style={{
              aspectRatio: `${item.imageSet ? presentationRatio(item.imageSet) : 1}`,
              width: `${Math.min(78, (item.imageSet ? presentationRatio(item.imageSet) : 1) * 60)}%`,
              ...(items.length === 1
                ? {
                    left: `${(100 - Math.min(78, (item.imageSet ? presentationRatio(item.imageSet) : 1) * 60)) / 2}%`,
                  }
                : {}),
            }}
          >
            <ArchiveImage
              src={item.image}
              alt={`${item.kind} from ${name}'s linked archive: ${item.title}`}
              imageSet={item.imageSet}
              variant={item.imageSet ? "small" : "display"}
              autoPrepare={false}
              originalPreserved
            />
          </div>
        ))
      ) : (
        <div className="person-material-empty">
          <span aria-hidden="true">↗</span>
          <p>
            {count
              ? `${count} linked ${count === 1 ? "item" : "items"} · previews pending`
              : "A story still to gather"}
          </p>
        </div>
      )}
    </div>
  );
}
