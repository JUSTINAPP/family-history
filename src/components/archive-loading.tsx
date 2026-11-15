import { PhotoLoadingStatus } from "./photo-loading-status";
export function ArchiveLoading({names=[],recover=false}:{names?:string[];recover?:boolean}={}) {
  return <div className="page-shell archive-loading" aria-label="Loading the archive" aria-busy="true">
    <PhotoLoadingStatus names={names} recover={recover}/>
    <div aria-hidden="true"><div className="loading-heading" /><div className="loading-photos">
      {Array.from({length:12},(_,i)=>i).map(i => <div key={i} className="loading-photo"><div /><span /></div>)}
    </div></div>
  </div>;
}
