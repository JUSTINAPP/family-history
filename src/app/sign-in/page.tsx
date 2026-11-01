import { AuthForm } from "@/components/live/auth-form";
import { PageIntro } from "@/components/ui";
import { supabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "@/lib/backend/errors";
export const metadata = { title: "Sign in to your archive" };
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const query = await searchParams;
  const configured = !!supabaseConfig();
  return (
    <div className="capture-shell">
      <PageIntro
        eyebrow="PRIVATE ARCHIVE"
        title="Sign in"
        description="Sign in to explore and contribute to the archives you belong to."
      />
      {!configured && (
        <p className="notice" role="status">
          Supabase configuration is not saved yet. Add the project URL and
          publishable key to the ignored .env.local file and restart the server.
          See docs/supabase-setup.md.
        </p>
      )}
      <AuthForm configured={configured} next={safeNext(query.next || null)} />
    </div>
  );
}
