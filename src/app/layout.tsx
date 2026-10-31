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
      ? `${initialArchive.name} — Still being discovered`
      : "Archive — A private place for what we keep",
    template: isDemoMode() ? `%s — ${initialArchive.name}` : "%s — Archive",
  },
  description:
    "Photographs, letters, documents and objects. A place to explore, contribute and keep the stories alive.",
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
        {isDemoMode() ? (
          <WorkspaceProvider>
            <Header />
            <main id="main">{children}</main>
            <Footer />
          </WorkspaceProvider>
        ) : (
          <SessionLayout>{children}</SessionLayout>
        )}
      </body>
    </html>
  );
}
