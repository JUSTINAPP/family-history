import {loadWorkspace} from "@/lib/backend/repository";
import {InviteForm} from "@/components/live/invite-form";
import {can} from "@/lib/permissions";
export const metadata={title:"Invite someone"};
export default async function InvitePage(){
  const snapshot=await loadWorkspace({shell:true});
  const role=snapshot?.members.find(m=>m.profileId===snapshot.profileId&&m.status==="active")?.role||"viewer";
  return <section className="capture-shell"><h1>Invite someone</h1>
    {snapshot&&can(role,"contributor")?<><p>Invite someone to {snapshot.archive.name}. They can choose their own password and join this archive.</p><InviteForm archiveId={snapshot.archive.id} archiveName={snapshot.archive.name}/></>:<p>A contributor or administrator can invite someone to the archive.</p>}
  </section>;
}
