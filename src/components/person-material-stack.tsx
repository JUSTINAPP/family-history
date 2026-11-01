"use client";
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
  return (
    <div
      className={`person-material-stack stack-${items.length}`}
      data-material-count={items.length}
    >
      {items.length ? (
        items.map((item, index) => (
          <div
            className={`material-leaf leaf-${index} material-${item.kind.toLowerCase()}`}
            key={item.id}
            data-item-id={item.id}
            style={{
              aspectRatio: `${presentationRatio(item.imageSet!)}`,
              width: `${Math.min(78, presentationRatio(item.imageSet!) * 60)}%`,
              ...(items.length === 1
                ? {
                    left: `${(100 - Math.min(78, presentationRatio(item.imageSet!) * 60)) / 2}%`,
                  }
                : {}),
            }}
          >
            <ArchiveImage
              src={item.image}
              alt={`${item.kind} from ${name}'s linked archive: ${item.title}`}
              imageSet={item.imageSet}
              variant="small"
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
