import { isDemoMode } from "@/lib/supabase/config";
import { LiveItem } from "@/components/live/live-item";
import { SavedCapture } from "@/components/saved-capture";
export const metadata = { title: "Captured material" };
export default async function SavedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return isDemoMode() ? <SavedCapture id={id} /> : <LiveItem id={id} />;
}
