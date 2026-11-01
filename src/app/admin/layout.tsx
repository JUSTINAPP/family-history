import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDemoMode } from "@/lib/supabase/config";
import { loadWorkspace, requireArchiveRole } from "@/lib/backend/repository";
import { AdminShell } from "@/components/admin/admin-shell";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isDemoMode()) {
    const path = (await headers()).get("x-archive-path") || "/admin";
    // This page checks its explicit archive and Editor role itself, including after a partial purge.
    if (path === "/admin/deletions") return children;
    const workspace = await loadWorkspace();
    if (workspace) {
      await requireArchiveRole(
        workspace.archive.id,
        path === "/admin/processing" ? "editor" : "admin",
      ).catch(() => redirect("/explore"));
    }
  }
  return <AdminShell>{children}</AdminShell>;
}
