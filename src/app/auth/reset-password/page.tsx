import Link from "next/link";
import { PageIntro } from "@/components/ui";
import { PasswordForm } from "@/components/live/password-form";
import { authenticatedClient } from "@/lib/supabase/server";
export const metadata = { title: "Choose a new password" };
export default async function ResetPasswordPage() {
  const session = await authenticatedClient().catch(() => null);
  return <div className="capture-shell"><PageIntro eyebrow="SYDNEY & AUROVILLE" title="Choose a new password" description="Use at least 8 characters. This will be your password next time you sign in." />
    {session ? <PasswordForm reset /> : <div className="auth-panel"><p className="notice" role="status">Open the newest reset link in your email first. If it has expired, request another below.</p><Link className="button" href="/auth/password">Request a reset link</Link></div>}
  </div>;
}
