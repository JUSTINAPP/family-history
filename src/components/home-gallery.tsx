"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ArchiveItem } from "@/lib/types";
import { ArchiveImage } from "./archive-image";
import { InlineConversation } from "./live/inline-conversation";
import { PhotoMemories } from "./audio/photo-memories";
import type { RecordingView } from "@/lib/audio/repository";

export function HomeGallery({ items, recordings = [] }: { items: ArchiveItem[]; recordings?: RecordingView[] }) {
  const track = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(12);
  function move(direction: number) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * .85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className="home-gallery">
    <div className="gallery-controls"><span>Swipe through the collection</span><div><button type="button" className="icon-button" aria-label="Previous photographs" onClick={() => move(-1)}><ArrowLeft size={20} /></button><button type="button" className="icon-button" aria-label="Next photographs" onClick={() => move(1)}><ArrowRight size={20} /></button></div></div>
    <section ref={track} className="home-scrapbook home-slider" aria-label="Material from your archive" tabIndex={0}>
      {items.slice(0, visible).map((item, index) => <article className={`scrapbook-piece scrapbook-piece-${index % 6}`} key={item.id}>
        <ArchiveImage src={item.image} alt={item.title} href={item.href} imageSet={item.imageSet} rotation={item.rotation} variant="small" autoPrepare={false} priority={index < 2} fitFrame sizes="(max-width: 820px) 80vw, 400px" />
        <Link prefetch={false} href={item.href!} className="scrapbook-caption"><span>{item.kind}</span><h2>{item.title}</h2></Link>
        <InlineConversation item={item} />
        <PhotoMemories itemId={item.id} title={item.title} recordings={recordings.filter(r => !r.archived && (r.itemId === item.id || r.items.includes(item.id)))} />
      </article>)}
      {visible < items.length && <div className="gallery-more"><button className="button" onClick={() => setVisible(count => count + 12)}>Show more images</button></div>}
    </section>
  </div>;
}
