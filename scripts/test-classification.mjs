import assert from "node:assert/strict";
export async function classificationChecks({q,asUser,asOwner,denied,users,archive,manifestFile}) {
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const one=async(sql,args=[])=>(await q(sql,args)).rows[0];
 await asUser(users[3]);
 const item=(await one("select public.begin_ingestion($1,gen_random_uuid(),'Photograph, still to be catalogued','Photograph','Preserved family words.','{\"date\":\"1984\",\"precision\":\"approximate\",\"place\":\"Sydney\"}',$2::jsonb) id",[archive,JSON.stringify([manifestFile])])).id;
 const file=await one("select * from public.archive_item_files where item_id=$1",[item]);
 await q("insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",[file.bucket_id,file.storage_path,JSON.stringify({size:file.byte_size,mimetype:file.mime_type})]);await q("select public.complete_ingestion($1,$2)",[archive,item]);
 await q("select public.post_item_comment($1,$2,'A family comment.',null,gen_random_uuid())",[archive,item]);
 await asUser(users[4]);
 const person=(await one("select public.save_person($1,'Classification person','other') id",[archive])).id;
 await q("select public.propose_identification($1,$2,$3,'A retained name')",[archive,item,person]);
 const place=(await one("select public.save_archive_place($1,null,'{\"name\":\"Classification place\"}') id",[archive])).id;
 await q("select public.link_item_place($1,$2,$3,'primary',false)",[archive,item,place]);
 const snapshot=async()=>({item:await one("select * from public.archive_items where id=$1",[item]),files:(await q("select * from public.archive_item_files where item_id=$1 order by id",[item])).rows,
  people:(await q("select * from public.identifications where item_id=$1 order by id",[item])).rows,places:(await q("select * from public.item_places where item_id=$1 order by id",[item])).rows,
  comments:(await q("select * from public.comments where item_id=$1 order by id",[item])).rows,words:(await q("select * from public.recollections where item_id=$1 order by id",[item])).rows});
 const before=await snapshot();
 await asUser(users[3]);const change="select public.set_item_kind($1,$2,$3,$4)";
 await q(change,[archive,item,'Letter','Photograph']);const after=await snapshot();eq(after.item.kind,'Letter');
 for(const key of ['title','reported_date','date_precision','reported_place','notes','people_text','evidence_status','catalogued_at','id','contributed_by'])eq(after.item[key],before.item[key]);
 for(const key of ['files','people','places','comments','words'])eq(after[key],before[key]);
 eq((await one("select public.document_snapshot($1) s",[item])).s.pages[0].id,file.id);
 await denied(change,[archive,item,'Document','Photograph']);await denied(change,[archive,item,'Audio','Letter']);
 await asUser(users[1]);await denied(change,[archive,item,'Object','Letter']);await asUser(null);await denied(change,[archive,item,'Object','Letter']);
 await asUser(users[4]);
 for(const [next,prior] of [['Document','Letter'],['Postcard','Document'],['Object','Postcard'],['Letter','Object']]){await q(change,[archive,item,next,prior]);eq((await one("select kind from public.archive_items where id=$1",[item])).kind,next);}
 const version=(await one("select public.document_snapshot($1) s",[item])).s.version;
 await q("select public.begin_document_run($1,gen_random_uuid(),$2,'transcribe',null,'fixture','fixture-model')",[item,version]);await denied(change,[archive,item,'Object','Letter']);
 await asOwner();await q("update public.document_runs set status='failed' where item_id=$1",[item]);await q("update public.archive_items set evidence_status='verified' where id=$1",[item]);
 await asUser(users[3]);await denied(change,[archive,item,'Document','Letter']);await asUser(users[4]);await q(change,[archive,item,'Document','Letter']);eq((await one("select evidence_status from public.archive_items where id=$1",[item])).evidence_status,'verified');
 await q("select public.set_item_archived($1,true)",[item]);await denied(change,[archive,item,'Letter','Document']);
 console.log(`Classification assertions passed: ${checks}; permission denials counted in main suite.`);return checks;
}
