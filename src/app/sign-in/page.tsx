import { AuthForm } from "@/components/live/auth-form";
import { PageIntro } from "@/components/ui";
import { supabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "@/lib/backend/errors";
export const metadata = { title: "Sign in to your archive" };
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  const configured = !!supabaseConfig();
  return (
    <div className="capture-shell">
      <PageIntro
        eyebrow="PRIVATE ARCHIVE"
        title="Sign in"
        description="Welcome to the Sydney & Auroville archive. Sign in to browse the collection and join the conversation."
      />
      {!configured && (
        <p className="notice" role="status">
          Supabase configuration is not saved yet. Add the project URL and
          publishable key to the ignored .env.local file and restart the server.
          See docs/supabase-setup.md.
        </p>
      )}
      {query.error === "confirmation" && <p className="notice" role="status">This email link has expired or could not be verified. Use the newest link, or choose Forgot password below to request another.</p>}
      <AuthForm configured={configured} next={safeNext(query.next || null)} />
    </div>
  );
}
