import { isDemoMode } from "@/lib/supabase/config";
import { BulkImport } from "@/components/live/bulk-import";
import { BulkUpload } from "@/components/bulk-upload";
export const metadata = { title: "Bulk upload" };
export default function BulkPage() {
  return isDemoMode() ? (
    <BulkUpload />
  ) : (
    <BulkImport />
  );
}
