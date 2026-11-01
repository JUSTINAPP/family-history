"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function DevelopmentPerformance() {
  const pathname = usePathname();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const report = () => {
      const resources = performance.getEntriesByType(
        "resource",
      ) as PerformanceResourceTiming[];
      const variants: Record<string, number> = {};
      document
        .querySelectorAll<HTMLImageElement>("img[data-image-variant]")
        .forEach((img) => {
          const v = img.dataset.imageVariant || "unknown";
          variants[v] = (variants[v] || 0) + 1;
        });
      const nav = performance.getEntriesByType("navigation")[0] as
        PerformanceNavigationTiming | undefined;
      console.info({
        event: "archive_browser",
        page:
          pathname === "/"
            ? "home"
            : pathname.startsWith("/people/")
              ? "person"
              : pathname.startsWith("/people")
                ? "people"
                : "explore",
        assetRequests: resources.filter((r) => r.initiatorType === "img")
          .length,
        scriptTransferBytes: resources
          .filter((r) => r.initiatorType === "script")
          .reduce((n, r) => n + r.transferSize, 0),
        fontTransferBytes: resources
          .filter((r) => /\/fonts\//.test(r.name))
          .reduce((n, r) => n + r.transferSize, 0),
        imageVariants: variants,
        responseStartMs: nav ? Math.round(nav.responseStart) : undefined,
      });
    };
    const observer = new PerformanceObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(report, 500);
    });
    observer.observe({ type: "resource", buffered: true });
    timer = setTimeout(report, 500);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname]);
  return null;
}
