"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ArchiveItem } from "@/lib/types";
import { InlineConversation } from "./live/inline-conversation";
import { PhotoMemories } from "./audio/photo-memories";
import type { RecordingView } from "@/lib/audio/repository";

export function HomeGallery({ items, recordings = [] }: { items: ArchiveItem[]; recordings?: RecordingView[] }) {
  const track = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(12);
  const [warmed, setWarmed] = useState(2);
  useEffect(() => {
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
    // Warm only the mounted batch, using small private previews after initial load.
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      let count = 2;
      const limit = Math.min(visible, items.length);
      timer = setInterval(() => {
        if (document.visibilityState !== "visible") return;
        count = Math.min(count + 2, limit);
        setWarmed(previous => Math.max(previous, count));
        if (count >= limit) clearInterval(timer);
      }, 600);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, {once: true});
    return () => {clearInterval(timer); window.removeEventListener("load", start);};
  }, [visible, items.length]);
  function move(direction: number) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * .85, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className="home-gallery">
    <div className="gallery-controls"><span>Swipe through the collection</span><div><button type="button" className="icon-button" aria-label="Previous photographs" onClick={() => move(-1)}><ArrowLeft size={20} /></button><button type="button" className="icon-button" aria-label="Next photographs" onClick={() => move(1)}><ArrowRight size={20} /></button></div></div>
    <section ref={track} className="home-scrapbook home-slider" aria-label="Material from your archive" tabIndex={0}>
      {items.slice(0, visible).map((item, index) => <article className={`scrapbook-piece scrapbook-piece-${index % 6}`} key={item.id}>
        <PhotoMemories item={item} priority={index < 2} eager={index < warmed} recordings={recordings.filter(r => !r.archived && (r.itemId === item.id || r.items.includes(item.id)))}>
        <Link prefetch={false} href={item.href!} className="scrapbook-caption"><span>{item.kind}</span><h2>{item.title}</h2></Link>
        <InlineConversation item={item} />
        </PhotoMemories>
      </article>)}
      {visible < items.length && <div className="gallery-more"><button className="button" onClick={() => setVisible(count => count + 12)}>Show more images</button></div>}
    </section>
  </div>;
}
