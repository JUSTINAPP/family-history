import assert from 'node:assert/strict';
export async function invitationChecks({q,asUser,asOwner,db,users}) {
  let checks=0;
  await asUser(users[0]);
  const archive=(await q("select public.create_archive('Invitation test','invitation-test') id")).rows[0].id;
  const create=async(email)=>(await q('select public.create_member_invitation($1,$2) token',[archive,email])).rows[0].token;
  const token=await create('TEST-1@example.test');assert.match(token,/^[a-f0-9]{64}$/);checks++;
  await asOwner();await db.exec('set role anon');
  const read=(await q('select public.read_member_invitation($1) info',[token])).rows[0].info;
  assert.equal(read.email,'test-1@example.test');assert.equal(read.archiveName,'Invitation test');checks++;
  await assert.rejects(()=>create('new@example.test'));checks++;
  assert.equal((await q('select public.read_member_invitation($1) info',['0'.repeat(64)])).rows[0].info,null);checks++;
  await asUser(users[2]);await assert.rejects(()=>q('select public.accept_member_invitation($1)',[token]));checks++;
  await asUser(users[1]);
  assert.equal((await q('select public.accept_member_invitation($1) id',[token])).rows[0].id,archive);checks++;
  assert.equal((await q('select public.accept_member_invitation($1) id',[token])).rows[0].id,archive);checks++;
  await asOwner();assert.equal((await q('select role from public.archive_memberships where archive_id=$1 and profile_id=$2',[archive,users[1]])).rows[0].role,'contributor');checks++;
  await asUser(users[0]);const old=await create('test-2@example.test'),fresh=await create('test-2@example.test');
  assert.equal((await q('select public.read_member_invitation($1) info',[old])).rows[0].info,null);checks++;
  await asOwner();await q("update public.invitations set expires_at=now()-interval '1 day' where archive_id=$1 and email=$2",[archive,'test-2@example.test']);
  await asUser(users[2]);await assert.rejects(()=>q('select public.accept_member_invitation($1)',[fresh]));checks++;
  await asUser(users[0]);await assert.rejects(()=>create('test-1@example.test'));checks++;
  await asOwner();
  console.log(`Invitation checks passed: ${checks}`);return checks;
}
