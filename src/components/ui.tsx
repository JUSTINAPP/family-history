import { ConversationLink } from "./conversation-link";
import { ArchiveImage } from "./archive-image";
export { ArchiveImage } from "./archive-image";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { ArchiveItem } from "@/lib/types";
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow">{children}</p>;
}
export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link className={`text-link ${className}`} href={href}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
export function ButtonLink({
  href,
  children,
  light = false,
}: {
  href: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <Link href={href} className={`button ${light ? "button-light" : ""}`}>
      {children}
      <ArrowRight size={17} />
    </Link>
  );
}
export function ItemCard({
  item,
  index = 0,
  imageSizes,
}: {
  item: ArchiveItem;
  index?: number;
  imageSizes?: string;
}) {
  return (
    <article className={`item-card item-${item.aspect}`}>
      <div className="item-image-link">
        <ArchiveImage
          src={item.image}
          alt={item.alt}
          href={item.href || `/archive/${item.slug}`}
          originalPreserved={item.sourcePreserved}
          imageSet={item.imageSet}
          rotation={item.rotation}
          variant="thumbnail"
          sizes={imageSizes}
        />
        <span className="image-arrow" style={{ pointerEvents: "none" }}>
          <ArrowUpRight size={20} />
        </span>
        {item.sourceCount && item.sourceCount > 1 ? (
          <span className="image-label">
            {item.sourceCount} {item.kind === "Letter" ? "pages" : "originals"}
          </span>
        ) : item.kind === "Letter" && !item.href ? (
          <span className="image-label">3 pages</span>
        ) : null}
      </div>
      <div className="card-caption">
        <span className="caption-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div>
          <Link prefetch={false} href={item.href || `/archive/${item.slug}`}>
            <h3>{item.title}</h3>
          </Link>
          <p>
            {item.kind} <span>·</span> {item.date}
          </p>
          <ConversationLink item={item} />
          {item.ingestionStatus && item.ingestionStatus !== "ready" && (
            <p className="help-line">
              {item.sourcePreserved
                ? "Original preserved · receipt incomplete"
                : "Original receipt pending"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
export function PageIntro({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="page-intro">
      <Eyebrow>{eyebrow}</Eyebrow>
      <div className="intro-row">
        <div>
          <h1>{title}</h1>
          <p className="intro-description">{description}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
