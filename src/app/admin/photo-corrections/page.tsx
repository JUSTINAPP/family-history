import {loadWorkspace,requireArchiveRole} from '@/lib/backend/repository';
import {BulkFraming} from '@/components/bulk-framing';
export const metadata={title:'Correct photo orientation'};
export default async function PhotoCorrections(){
 const workspace=await loadWorkspace({materialOnly:true});if(!workspace)return null;
 await requireArchiveRole(workspace.archive.id,'admin');
 const photos=workspace.catalogue.filter(item=>item.kind==='Photograph'&&!item.archivedAt);
 return <section><h1>Photo corrections</h1><p>Check {photos.length} photographs for sideways or upside-down images. Review uncertain suggestions separately.</p>{!workspace.catalogueAvailable?<p role="alert">The collection could not load. Refresh to try again.</p>:photos.length?<BulkFraming itemIds={photos.map(item=>item.id)} rotationOnly/>:<p>No photographs to check.</p>}</section>;
}
