"use client";
import NextLink, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
function Progress() {
  const { pending } = useLinkStatus();
  return <span className="navigation-progress" data-pending={pending} role={pending ? "status" : undefined} aria-label={pending ? "Loading page" : undefined}>{pending && <span className="navigation-spinner" aria-hidden="true" />}</span>;
}
export function PendingLink({ children, className = "", ...props }: ComponentProps<typeof NextLink>) {
  return <NextLink {...props} className={`feedback-link ${className}`}>{children}<Progress /></NextLink>;
}
