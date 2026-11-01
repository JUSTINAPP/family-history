import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Header, Footer } from "../header";
import { LiveWorkspaceProvider } from "./live-workspace";
import { CreateArchive } from "./create-archive";
import { loadWorkspace, requireSession } from "@/lib/backend/repository";
import { safeError } from "@/lib/backend/errors";
import { signOut } from "@/app/sign-in/actions";
import { DevelopmentPerformance } from "./development-performance";
export function PublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/">
          Archive.
        </Link>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <p>A private place for what we keep.</p>
      </footer>
    </>
  );
}
export async function SessionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const path = (await headers()).get("x-archive-path") || "/";
  if (path === "/sign-in" || path.startsWith("/auth/"))
    return <PublicChrome>{children}</PublicChrome>;
  let auth;
  try {
    auth = await requireSession();
  } catch {
    redirect("/sign-in");
  }
  let snapshot;
  try {
    const pageLoadsMaterial =
      ["/", "/explore", "/people"].includes(path) ||
      path.startsWith("/people/") ||
      path.startsWith("/archive/");
    snapshot = await loadWorkspace({
      catalogue: !pageLoadsMaterial,
      shell: pageLoadsMaterial,
      archiveId: (await headers()).get("x-archive-id") || undefined,
    });
  } catch (error) {
    return (
      <PublicChrome>
        <div className="capture-shell">
          <section className="page-intro">
            <p className="eyebrow">BACKEND SETUP</p>
            <h1>Your archive is nearly ready.</h1>
            <p className="notice">{safeError(error).message}</p>
            <p className="help-line">
              Signed in. Follow docs/supabase-setup.md to apply the migrations,
              then reload. No fictional records have been inserted.
            </p>
            <form action={signOut}>
              <button className="subtle-button">Sign out</button>
            </form>
          </section>
        </div>
      </PublicChrome>
    );
  }
  if (!auth.user) redirect("/sign-in");
  if (!snapshot)
    return (
      <PublicChrome>
        <CreateArchive />
        <form action={signOut} className="capture-shell">
          <button className="subtle-button">Sign out</button>
        </form>
      </PublicChrome>
    );
  return (
    <LiveWorkspaceProvider
      key={`${snapshot.archive.id}:${snapshot.catalogueBatchId || "all"}`}
      snapshot={snapshot}
    >
      <Header />
      <main id="main">{children}</main>
      {process.env.NODE_ENV === "development" &&
        process.env.ARCHIVE_PERF_DIAGNOSTICS === "1" && (
          <DevelopmentPerformance />
        )}
      <Footer />
    </LiveWorkspaceProvider>
  );
}
