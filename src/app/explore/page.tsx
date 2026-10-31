import { Suspense } from "react";
import { Explore } from "@/components/explore";
export const metadata = { title: "Explore the archive" };
export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <p className="page-intro">Opening the archive…</p>
        </div>
      }
    >
      <Explore />
    </Suspense>
  );
}
