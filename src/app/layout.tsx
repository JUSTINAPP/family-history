import { ImportSelectionProvider } from "@/components/import-selection";
import { initialArchive } from "@/lib/demo-workspace";
import type { Metadata } from "next";
import { Header, Footer } from "@/components/header";
import "./globals.css";
import { isDemoMode } from "@/lib/supabase/config";
import { SessionLayout } from "@/components/live/session-layout";
export const dynamic = "force-dynamic";
import { WorkspaceProvider } from "@/components/workspace-provider";
export const metadata: Metadata = {
  title: {
    default: isDemoMode()
      ? `${initialArchive.name} — Archive`
      : "Allen & Cork — Archive",
    template: isDemoMode() ? `%s — ${initialArchive.name}` : "%s — Archive",
  },
  description:
    "Explore photographs, letters, documents and objects in a private archive.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" data-scroll-behavior="smooth">
      <body>
        <ImportSelectionProvider>
          {isDemoMode() ? (
            <WorkspaceProvider>
              <Header />
              <main id="main">{children}</main>
              <Footer />
            </WorkspaceProvider>
          ) : (
            <SessionLayout>{children}</SessionLayout>
          )}
        </ImportSelectionProvider>
      </body>
    </html>
  );
}
