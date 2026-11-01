import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function documentChecks({q,asUser,asOwner,denied,users,archive,manifestFile}) {
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const one=async(sql,args=[])=>(await q(sql,args)).rows[0];
 const snapshot=async(item)=>(await one("select public.document_snapshot($1) s",[item])).s;
 const make=async(count)=>{
  const files=Array.from({length:count},(_,n)=>({...manifestFile,name:`letter-${n}.png`,role:n===0?'envelope-front':n===1?'envelope-back':'page'}));
  const id=(await one("select public.begin_ingestion($1,gen_random_uuid(),'A preserved letter','Letter','','{}',$2::jsonb) id",[archive,JSON.stringify(files)])).id;
  for(const f of (await q("select * from public.archive_item_files where item_id=$1 order by page_order",[id])).rows)
   await q("insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",[f.bucket_id,f.storage_path,JSON.stringify({size:f.byte_size,mimetype:f.mime_type})]);
  await q("select public.complete_ingestion($1,$2)",[archive,id]);return id;
 };
 await asUser(users[3]);
 const two=await make(2);eq((await snapshot(two)).pages.map(p=>p.page_order),[0,1]);
 const item=await make(4);const snap=await snapshot(item);eq(snap.pages.length,4);eq(snap.pages.map(p=>p.page_role),['envelope-front','envelope-back','page','page']);
 const hashes=snap.pages.map(p=>p.sha256);
 const begin="select public.begin_document_run($1,$2,$3,$4,$5,'fixture',$6) r";
 const request=randomUUID();let run=(await one(begin,[item,request,snap.version,'transcribe',null,'fixture-v1'])).r;
 eq((await one(begin,[item,request,snap.version,'transcribe',null,'fixture-v1'])).r.id,run.id);
 await denied(begin,[item,randomUUID(),snap.version,'transcribe',null,'fixture-v1']);
 await denied("select public.set_item_archived($1,true)",[item]);
 const claim="select public.claim_document_page($1,$2) c",save="select public.save_document_page($1,$2,$3,$4::jsonb) id",finish="select public.finish_document_run($1,$2::jsonb,$3)";
 await denied("select public.claim_document_extraction($1)",[run.id]);
 const texts=['Cher Jan, Auroville, 17 August 1978.','Bonjour [unclear]','We will travel together.','Your friend.'];
 for(let n=0;n<4;n++) {
  const file=snap.pages[n].id;const c=(await one(claim,[run.id,file])).c;
  await denied(claim,[run.id,file]);
  await denied(save,[run.id,file,null,JSON.stringify({text:'forged'})]);
  await q(save,[run.id,file,c.token,JSON.stringify({text:texts[n],language:'fr',uncertainty:n===1?['Illegible name']:[],confidence:null,receipt:{provider:'anthropic',responseId:'msg_fixture',model:'fixture-resolved',usage:{input_tokens:10,output_tokens:5}},rawResponse:{id:'msg_fixture',type:'message',content:[{type:'text',text:JSON.stringify({text:texts[n]})}],stop_reason:'end_turn'}})]);
  eq((await one(claim,[run.id,file])).c.cached,true);
 }
 eq((await one("select count(*)::int n from public.transcriptions where document_run_id=$1",[run.id])).n,4);
 eq((await one("select model from public.transcriptions where document_run_id=$1 order by page_order_snapshot limit 1",[run.id])).model,'fixture-resolved');
 eq((await one("select output->$2->'rawResponse'->>'id' id from public.document_runs where id=$1",[run.id,snap.pages[0].id])).id,'msg_fixture');
 eq((await one("select count(*)::int n from public.identifications where item_id=$1",[item])).n,0);
 const extraction=(await one("select public.claim_document_extraction($1) c",[run.id])).c;
 await denied("select public.claim_document_extraction($1)",[run.id]);
 const suggestions=[
  {kind:'person',value:'Jan',evidence:'Jan',page:1,context:'mentioned'},
  {kind:'sender',value:'Jan',evidence:'Jan',page:1,context:'sender'},
  {kind:'recipient',value:'Tina',evidence:'Your friend.',page:4,context:'recipient'},
  {kind:'place',value:'Auroville',evidence:'Auroville',page:1,context:'written_in'},
  {kind:'date',value:'1978-08-17',evidence:'17 August 1978',page:1,context:'written_date'},
  {kind:'summary',value:'A letter about travel.',evidence:'travel',page:3,context:''},
  {kind:'topic',value:'travel',evidence:'travel',page:3,context:''},
 ];
 await q(finish,[run.id,JSON.stringify({suggestions}),extraction.token]);
 await q(finish,[run.id,JSON.stringify({suggestions}),extraction.token]);
 eq((await one("select count(*)::int n from public.metadata_suggestions where document_run_id=$1",[run.id])).n,7);
 eq((await one("select count(*)::int n from public.item_places where item_id=$1",[item])).n,0);
 await asUser(users[4]);
 const person=(await one("select public.save_person($1,'Jan from letter','other') id",[archive])).id;
 const place=(await one("select public.save_archive_place($1,null,'{\"name\":\"Auroville\"}') id",[archive])).id;
 const rows=(await q("select * from public.metadata_suggestions where document_run_id=$1 order by id",[run.id])).rows;
 const selection=(kind,extra={})=>({id:rows.find(s=>s.suggested_value.kind===kind).id,action:'accept',value:rows.find(s=>s.suggested_value.kind===kind).suggested_value.value,...extra});
 const apply="select public.apply_document_suggestions($1,$2::jsonb,$3::jsonb)";
 const chosen=[selection('person',{canonical_id:person,context:'mentioned'}),selection('place',{canonical_id:place,context:'written_in'}),selection('date',{context:'written_date',precision:'exact'}),selection('summary')];
 await denied(apply,[run.id,JSON.stringify(chosen),JSON.stringify({value:'stale',precision:'unknown'})]);
 eq((await one("select count(*)::int n from public.identifications where item_id=$1",[item])).n,0);
 await q(apply,[run.id,JSON.stringify(chosen),JSON.stringify({value:'',precision:'unknown'})]);
 await q(apply,[run.id,JSON.stringify(chosen),JSON.stringify({value:'',precision:'unknown'})]);
 eq((await one("select person_id,status,role_context from public.identifications where item_id=$1",[item])),{person_id:person,status:'accepted',role_context:'mentioned'});
 eq((await one("select place_id,role,status from public.item_places where item_id=$1",[item])),{place_id:place,role:'written_in',status:'confirmed'});
 eq((await one("select reported_date,date_precision from public.archive_items where id=$1",[item])),{reported_date:'1978-08-17',date_precision:'exact'});
 // Explicit reviewed text never creates a Person; canonical sender uses the existing relationship.
 const expectedDate=JSON.stringify({value:'1978-08-17',precision:'exact'});
 const textRecipient=selection('recipient',{context:'recipient',value:'Tina',canonical_id:'',create:false,text_only:true});
 const initialPeople=(await one("select count(*)::int n from public.people where archive_id=$1",[archive])).n;
 const initialLinks=(await one("select count(*)::int n from public.identifications where item_id=$1",[item])).n;
 for(const extra of [{context:'sender'},{canonical_id:person},{create:true},{text_only:false},{value:''}])await denied(apply,[run.id,JSON.stringify([{...textRecipient,...extra}]),expectedDate]);
 await asUser(users[3]);await denied(apply,[run.id,JSON.stringify([textRecipient]),expectedDate]);
 await asUser(users[1]);await denied(apply,[run.id,JSON.stringify([textRecipient]),expectedDate]);
 await asUser(null);await denied(apply,[run.id,JSON.stringify([textRecipient]),expectedDate]);
 await asUser(users[4]);
 await q(apply,[run.id,JSON.stringify([textRecipient]),expectedDate]);
 await q(apply,[run.id,JSON.stringify([textRecipient]),expectedDate]);
 await denied(apply,[run.id,JSON.stringify([{...textRecipient,value:'Another person'}]),expectedDate]);
 eq((await one("select count(*)::int n from public.people where archive_id=$1",[archive])).n,initialPeople);
 eq((await one("select count(*)::int n from public.identifications where item_id=$1",[item])).n,initialLinks);
 const kept=await one("select suggested_value,reviewed_value,status from public.metadata_suggestions where id=$1",[textRecipient.id]);
 eq(kept.reviewed_value,textRecipient);eq(kept.status,'accepted');eq(kept.suggested_value.value,'Tina');
 eq((await one("select count(*)::int n from public.provenance where item_id=$1 and field_path='document_suggestion_review' and value->'decision'->>'text_only'='true'",[item])).n,1);
 await q(apply,[run.id,JSON.stringify([selection('sender',{canonical_id:person,context:'sender'})]),expectedDate]);
 eq((await one("select role_context from public.identifications where item_id=$1 and person_id=$2",[item,person])).role_context,'mentioned; sender');
 eq((await q("select sha256 from public.archive_item_files where item_id=$1 and purpose='original' order by page_order",[item])).rows.map(f=>f.sha256),hashes);
 const page=(await one("select * from public.transcriptions where document_run_id=$1 order by page_order_snapshot limit 1",[run.id]));
 await q("select public.review_document_page($1,'Dear Jan, a corrected reading.',0)",[page.id]);
 await denied("select public.review_document_page($1,'Stale correction',0)",[page.id]);
 eq((await one("select raw_ai_text,reviewed_text,review_revision from public.transcriptions where id=$1",[page.id])),{raw_ai_text:texts[0],reviewed_text:'Dear Jan, a corrected reading.',review_revision:1});
 const translation=(await one(begin,[item,randomUUID(),snap.version,'translate',run.id,'fixture-v1'])).r;
 eq(translation.source_texts[0].text,'Dear Jan, a corrected reading.');
 await q("select public.review_transcription($1,$2,'A later human correction.')",[archive,page.id]);
 eq((await one("select review_revision from public.transcriptions where id=$1",[page.id])).review_revision,2);
 eq((await one("select source_texts from public.document_runs where id=$1",[translation.id])).source_texts[0].text,'Dear Jan, a corrected reading.');
 for(const file of snap.pages) {
  const c=(await one(claim,[translation.id,file.id])).c;
  await q(save,[translation.id,file.id,c.token,JSON.stringify({text:'English translation, separate from source.',language:'en',confidence:null,uncertainty:[]})]);
 }
 const translateClaim=(await one("select public.claim_document_extraction($1) c",[translation.id])).c;
 await denied(finish,[translation.id,JSON.stringify({suggestions}),translateClaim.token]);
 await q(finish,[translation.id,'{"suggestions":[]}',translateClaim.token]);
 eq((await one("select count(*)::int n from public.transcriptions where item_id=$1 and output_kind='translation'",[item])).n,4);
 eq((await one("select raw_ai_text from public.transcriptions where id=$1",[page.id])).raw_ai_text,texts[0]);
 const rerun=(await one(begin,[item,randomUUID(),snap.version,'transcribe',null,'fixture-v2'])).r;
 const first=(await one(claim,[rerun.id,snap.pages[0].id])).c;
 await q("select public.set_document_run_state($1,false,'interrupted')",[rerun.id]);
 await denied(save,[rerun.id,snap.pages[0].id,first.token,JSON.stringify({text:'late reply'})]);
 await q("select public.set_document_run_state($1,true,'interrupted')",[rerun.id]);
 const replacement=(await one(claim,[rerun.id,snap.pages[0].id])).c;
 await q(save,[rerun.id,snap.pages[0].id,replacement.token,JSON.stringify({text:'Second model reading.',confidence:null})]);
 eq((await one("select version from public.transcriptions where document_run_id=$1",[rerun.id])).version,3);
 await q("select public.set_document_run_state($1,false,'cancelled')",[rerun.id]);
 await q("select public.order_document_pages($1,$2,$3::uuid[],$4::text[])",[item,snap.version,snap.pages.map(p=>p.id).reverse(),['page','page','envelope-back','envelope-front']]);
 const reordered=await snapshot(item);eq(reordered.pages.map(p=>p.id),snap.pages.map(p=>p.id).reverse());eq(reordered.pages.map(p=>p.sha256),hashes);
 eq((await one("select page_order_snapshot from public.transcriptions where id=$1",[page.id])).page_order_snapshot,0);
 await denied(begin,[item,randomUUID(),snap.version,'transcribe',null,'fixture-v3']);
 await denied(apply,[run.id,JSON.stringify([selection('topic')]),JSON.stringify({value:'1978-08-17',precision:'exact'})]);
 await asUser(users[1]);
 await denied("select public.document_snapshot($1)",[item]);
 await denied(begin,[item,randomUUID(),reordered.version,'transcribe',null,'fixture-v1']);
 eq((await one("select count(*)::int n from public.document_runs where item_id=$1",[item])).n,0);
 await asUser(null);await denied("select public.document_snapshot($1)",[item]);
 await asUser(users[3]);await denied("select public.review_document_page($1,'No Editor permission',2)",[page.id]);
 await denied(apply,[run.id,'[]','{}']);
 await asUser(users[4]);
 await q("select public.set_item_archived($1,true)",[item]);
 const state=(await one("select public.item_management_snapshot($1) s",[item])).s;
 const deletion=(await one("select public.begin_item_deletion($1,$2,'DELETE') d",[item,state.version])).d;
 await asOwner();await q("delete from storage.objects where name in (select storage_path from public.archive_item_files where item_id=$1)",[item]);
 await asUser(users[4]);await q("select public.finish_item_deletion($1)",[deletion.id]);
 eq((await one("select count(*)::int n from public.document_runs where item_id=$1",[item])).n,0);
 console.log(`Document assertions passed: ${checks}; permission denials counted in main suite.`);return checks;
}
