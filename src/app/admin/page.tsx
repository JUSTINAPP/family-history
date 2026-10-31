import { isDemoMode } from "@/lib/supabase/config";
import { LiveAdmin } from "@/components/live/admin";
import { AdminPage } from "@/components/admin/admin-pages";
export const metadata = { title: "Archive administration" };
export default function Admin() {
  return isDemoMode() ? <AdminPage /> : <LiveAdmin />;
}
