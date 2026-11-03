export function ArchiveLoading() {
  return <div className="page-shell archive-loading" role="status" aria-label="Loading the archive" aria-busy="true">
    <span className="archive-loading-label">Loading the archive…</span>
    <div aria-hidden="true"><div className="loading-heading" /><div className="loading-photos">
      {[0, 1, 2, 3].map(i => <div key={i} className="loading-photo"><div /><span /></div>)}
    </div></div>
  </div>;
}
