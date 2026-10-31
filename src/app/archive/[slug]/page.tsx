import { isDemoMode } from "@/lib/supabase/config";
import { LiveItem } from "@/components/live/live-item";
import { notFound } from "next/navigation";
import { items } from "@/lib/data";
import { ItemDetail } from "@/components/item-detail";
export function generateStaticParams() {
  if (!isDemoMode()) return [];
  return items.map((i) => ({ slug: i.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isDemoMode()) return { title: "Archive item" };
  return { title: items.find((i) => i.slug === slug)?.title || "Archive item" };
}
export default async function ItemPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isDemoMode()) return <LiveItem id={slug} />;
  const item = items.find((i) => i.slug === slug);
  if (!item) notFound();
  return <ItemDetail item={item} />;
}
