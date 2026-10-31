"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-shell">
      <section className="page-intro">
        <p className="eyebrow">THE ARCHIVE IS TEMPORARILY UNAVAILABLE</p>
        <h1>A moment to try again.</h1>
        <p className="notice">
          This part of the archive could not load. Check the connection and
          database setup in docs/supabase-setup.md, then try again. Original
          files have not been changed.
        </p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </section>
    </div>
  );
}
