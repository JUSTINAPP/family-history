import { isDemoMode } from "@/lib/supabase/config";
import { LiveAdmin } from "@/components/live/admin";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-pages";
const sections = [
  "members",
  "invitations",
  "settings",
  "processing",
  "activity",
];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  return { title: `Admin · ${section[0]?.toUpperCase() + section.slice(1)}` };
}
export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return isDemoMode() ? (
    <AdminPage section={section} />
  ) : (
    <LiveAdmin section={section} />
  );
}
