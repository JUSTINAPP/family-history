import Link from "next/link";
import type { ArchiveItem } from "@/lib/types";
export function ConversationLink({item}:{item:ArchiveItem}) {
  if(item.commentCount===undefined || item.archivedAt || item.ingestionStatus!=="ready")return null;
  return <Link prefetch={false} className="conversation-link" href={`${item.href||`/archive/${item.slug}`}#family-conversation`} aria-label={`${item.commentCount?`${item.commentCount} ${item.commentCount===1?"comment":"comments"}`:"Add a comment"} on ${item.title}`}>
    {item.commentCount?`${item.commentCount} ${item.commentCount===1?"comment":"comments"}`:"Add a comment"}
  </Link>;
}
