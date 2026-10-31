import { isDemoMode } from "@/lib/supabase/config";
import { BulkImport } from "@/components/live/bulk-import";
import { BulkUpload } from "@/components/bulk-upload";
export const metadata = { title: "Bulk upload" };
export default async function BulkPage({
  searchParams,
}: {
  searchParams: Promise<{ workflow?: string }>;
}) {
  return isDemoMode() && (await searchParams).workflow !== "import" ? (
    <BulkUpload />
  ) : (
    <BulkImport />
  );
}
