import { isDemoMode } from "@/lib/supabase/config";
import Link from "next/link";
import { notFound } from "next/navigation";
import { items } from "@/lib/data";
import { TranscriptionReview } from "@/components/transcription-review";
export const metadata = { title: "Letter transcription review" };
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isDemoMode()) notFound();
  const { slug } = await params;
  const item = items.find((i) => i.slug === slug && i.kind === "Letter");
  if (!item) notFound();
  return (
    <div className="page-shell">
      <div className="breadcrumb">
        <Link href={`/archive/${item.slug}`}>{item.title}</Link>
        <span>/</span>
        <span>Transcription review</span>
      </div>
      <h1 className="review-page-title">A letter, in its own words.</h1>
      <TranscriptionReview itemId={item.id} />
    </div>
  );
}
