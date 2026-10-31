import { isDemoMode } from "@/lib/supabase/config";
import { PageIntro, ButtonLink } from "@/components/ui";
import { BulkUpload } from "@/components/bulk-upload";
export const metadata = { title: "Bulk upload" };
export default function BulkPage() {
  return isDemoMode() ? (
    <BulkUpload />
  ) : (
    <div className="page-shell">
      <PageIntro
        eyebrow="PERSISTENT CAPTURE"
        title="One by one, for now."
        description="The first real upload flow preserves photographs, letters and object images. Durable bulk imports will follow."
      />
      <ButtonLink href="/add">Open capture</ButtonLink>
    </div>
  );
}
