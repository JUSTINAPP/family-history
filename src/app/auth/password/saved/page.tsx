import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/ui";
import { authenticatedClient } from "@/lib/supabase/server";
export default async function PasswordSavedPage() {
  if (!await authenticatedClient()) redirect("/sign-in");
  return <div className="capture-shell"><PageIntro eyebrow="SYDNEY & AUROVILLE" title="Password saved" description="You are signed in. Use your new password next time you visit." /><Link className="button" href="/">Open the collection</Link></div>;
}
