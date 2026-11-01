begin;
-- Explicit document runs only. Original bytes, existing reviews and earlier runs are retained.
create table public.document_runs (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null,
 request_id uuid not null, initiated_by uuid not null references public.profiles(id),
 operation text not null check(operation in ('transcribe','translate')), source_run_id uuid,
 source_version text not null, source_manifest jsonb not null, source_texts jsonb not null default '[]',
 provider text not null check(provider ~ '^[a-z][a-z0-9_-]{0,39}$'), model text not null check(length(model) between 1 and 150),
 status text not null default 'processing' check(status in ('processing','failed','complete')),
 error_code text, output jsonb not null default '{}', claims jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), completed_at timestamptz,
 unique(archive_id,item_id,id),unique(initiated_by,request_id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id) on delete cascade,
 foreign key(archive_id,item_id,source_run_id) references public.document_runs(archive_id,item_id,id) on delete cascade deferrable initially deferred,
 check((operation='transcribe' and source_run_id is null) or (operation='translate' and source_run_id is not null))
);
create index document_run_item on public.document_runs(archive_id,item_id,created_at desc,id);
alter table public.document_runs enable row level security;
alter table public.document_runs force row level security;
revoke all on public.document_runs from public,anon,authenticated;
grant select on public.document_runs to authenticated;
create policy document_run_read on public.document_runs for select to authenticated using(archive_private.item_readable(archive_id,item_id));
create trigger guard_item_lifecycle before insert or update on public.document_runs for each row execute function archive_private.guard_item_content();
alter table public.transcriptions add column document_run_id uuid references public.document_runs(id) on delete cascade;
alter table public.transcriptions add column page_order_snapshot integer;
alter table public.transcriptions add column output_kind text not null default 'source' check(output_kind in ('source','translation'));
alter table public.transcriptions add column review_revision integer not null default 0;
create unique index document_page_once on public.transcriptions(document_run_id,original_file_id) where document_run_id is not null;
alter table public.metadata_suggestions add column document_run_id uuid references public.document_runs(id) on delete cascade;
alter table public.metadata_suggestions add column reviewed_value jsonb;
create index document_suggestion_run on public.metadata_suggestions(document_run_id,id);

create function archive_private.document_snapshot(i uuid) returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('version',md5(coalesce(jsonb_agg(jsonb_build_object('id',id,'page_order',page_order,'page_role',page_role,'sha256',sha256) order by page_order,id),'[]')::text),
 'pages',coalesce(jsonb_agg(jsonb_build_object('id',id,'page_order',page_order,'page_role',page_role,'sha256',sha256) order by page_order,id),'[]'))
 from public.archive_item_files where item_id=i and purpose='original' and status='stored'
$$;
create function public.document_snapshot(p_item_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;begin
 select * into i from public.archive_items where id=p_item_id;
 if i.id is null or i.kind not in ('Letter','Document','Postcard','Certificate') or not archive_private.item_readable(i.archive_id,i.id) then raise exception 'permission_denied' using errcode='42501';end if;
 return archive_private.document_snapshot(i.id);
end $$;
create function archive_private.can_process_document(i uuid) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare x public.archive_items;begin
 select * into x from public.archive_items where id=i for no key update;
 return x.id is not null and x.kind in ('Letter','Document','Postcard','Certificate') and x.archived_at is null
 and archive_private.can_edit_item_places(x.archive_id,x.id);
end $$;
create function public.begin_document_run(p_item_id uuid,p_request_id uuid,p_version text,p_operation text,p_source_run_id uuid,p_provider text,p_model text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;r public.document_runs;s public.document_runs;snap jsonb;texts jsonb:='[]';begin
 if not archive_private.can_process_document(p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into i from public.archive_items where id=p_item_id;
 snap:=archive_private.document_snapshot(i.id);
 if p_request_id is null or p_version is distinct from snap->>'version' or jsonb_array_length(snap->'pages') not between 1 and 20 then raise exception 'document_source_changed';end if;
 select * into r from public.document_runs where initiated_by=auth.uid() and request_id=p_request_id;
 if found then
  if r.item_id<>i.id or r.source_version<>p_version or r.operation is distinct from p_operation or r.source_run_id is distinct from p_source_run_id then raise exception 'document_retry_conflict';end if;
  return to_jsonb(r);
 end if;
 if exists(select 1 from public.document_runs where item_id=i.id and status='processing' and updated_at>now()-interval '3 minutes') then raise exception 'document_busy' using errcode='55P03';end if;
 update public.document_runs set status='failed',error_code='interrupted',updated_at=now(),claims='{}' where item_id=i.id and status='processing';
 if p_operation='translate' then
  select * into s from public.document_runs where id=p_source_run_id and item_id=i.id and operation='transcribe' and source_version=p_version;
  if s.id is null or (select count(*) from public.transcriptions where document_run_id=s.id)<>jsonb_array_length(s.source_manifest) then raise exception 'source_transcription_required';end if;
  select jsonb_agg(jsonb_build_object('original_file_id',original_file_id,'text',coalesce(reviewed_text,raw_ai_text),'transcription_id',id,'review_revision',review_revision) order by page_order_snapshot) into texts from public.transcriptions where document_run_id=s.id;
 elsif p_operation is distinct from 'transcribe' or p_source_run_id is not null then raise exception 'invalid_document_operation';end if;
 insert into public.document_runs(archive_id,item_id,request_id,initiated_by,operation,source_run_id,source_version,source_manifest,source_texts,provider,model)
 values(i.archive_id,i.id,p_request_id,auth.uid(),p_operation,p_source_run_id,p_version,snap->'pages',texts,p_provider,p_model) returning * into r;
 insert into public.processing_jobs(archive_id,item_id,stage,status,attempts) values(i.archive_id,i.id,'document_'||p_operation,'processing',1)
 on conflict(item_id,stage) do update set status='processing',attempts=processing_jobs.attempts+1,error_code=null,updated_at=now();
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(i.archive_id,i.id,auth.uid(),'document_run_started',jsonb_build_object('run_id',r.id,'operation',p_operation,'source_version',p_version,'page_count',jsonb_array_length(r.source_manifest),'provider',r.provider,'model',r.model),'ai_suggested');
 return to_jsonb(r);
end $$;
create function public.claim_document_page(p_run_id uuid,p_file_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_runs;t uuid:=gen_random_uuid();c jsonb;begin
 select * into r from public.document_runs where id=p_run_id;
 if r.id is null or not archive_private.can_process_document(r.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into r from public.document_runs where id=p_run_id for update;
 if not exists(select 1 from jsonb_array_elements(r.source_manifest) p where (p->>'id')::uuid=p_file_id) then raise exception 'invalid_document_page';end if;
 if exists(select 1 from public.transcriptions where document_run_id=r.id and original_file_id=p_file_id) then return jsonb_build_object('cached',true);end if;
 if r.status<>'processing' or r.source_version is distinct from archive_private.document_snapshot(r.item_id)->>'version' then raise exception 'document_source_changed';end if;
 c:=r.claims->p_file_id::text;
 if c is not null and (c->>'at')::timestamptz>now()-interval '2 minutes' then raise exception 'document_page_busy' using errcode='55P03';end if;
 update public.document_runs set claims=jsonb_set(claims,array[p_file_id::text],jsonb_build_object('token',t,'at',now())),updated_at=now() where id=r.id;
 return jsonb_build_object('cached',false,'token',t);
end $$;
create function public.save_document_page(p_run_id uuid,p_file_id uuid,p_token uuid,p_output jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_runs;f jsonb;ident uuid;v integer;begin
 select * into r from public.document_runs where id=p_run_id;
 if r.id is null or not archive_private.can_process_document(r.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into r from public.document_runs where id=p_run_id for update;
 if p_token is null or r.status<>'processing' or not (r.claims ? p_file_id::text) or (r.claims->p_file_id::text->>'token') is distinct from p_token::text or (r.claims->p_file_id::text->>'at')::timestamptz<now()-interval '2 minutes' or r.source_version is distinct from archive_private.document_snapshot(r.item_id)->>'version' then raise exception 'stale_document_page';end if;
 if jsonb_typeof(p_output) is distinct from 'object' or jsonb_typeof(p_output->'text') is distinct from 'string' or length(p_output->>'text')>50000 or length(p_output::text)>100000 then raise exception 'invalid_document_output';end if;
 select p into f from jsonb_array_elements(r.source_manifest) p where (p->>'id')::uuid=p_file_id;
 if f is null then raise exception 'invalid_document_page';end if;
 select coalesce(max(version),0)+1 into v from public.transcriptions where original_file_id=p_file_id and modality='handwriting';
 insert into public.transcriptions(archive_id,item_id,original_file_id,modality,raw_ai_text,provider,model,confidence,version,document_run_id,page_order_snapshot,output_kind)
 values(r.archive_id,r.item_id,p_file_id,'handwriting',p_output->>'text',r.provider,coalesce(nullif(p_output#>>'{receipt,model}',''),r.model),(p_output->>'confidence')::numeric,v,r.id,(f->>'page_order')::integer,case when r.operation='translate' then 'translation' else 'source' end)
 on conflict(document_run_id,original_file_id) where document_run_id is not null do nothing returning id into ident;
 if ident is null then select id into ident from public.transcriptions where document_run_id=r.id and original_file_id=p_file_id;end if;
 update public.document_runs set output=jsonb_set(output,array[p_file_id::text],p_output),claims=claims-p_file_id::text,updated_at=now() where id=r.id;
 return ident;
end $$;
create function public.claim_document_extraction(p_run_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_runs;t uuid:=gen_random_uuid();begin
 select * into r from public.document_runs where id=p_run_id;
 if r.id is null or not archive_private.can_process_document(r.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into r from public.document_runs where id=p_run_id for update;
 if r.status='complete' then return jsonb_build_object('cached',true);end if;
 if r.status<>'processing' or r.source_version is distinct from archive_private.document_snapshot(r.item_id)->>'version' then raise exception 'document_source_changed';end if;
 if (select count(*) from public.transcriptions where document_run_id=r.id)<>jsonb_array_length(r.source_manifest) then raise exception 'document_pages_incomplete';end if;
 if (r.claims->'$extraction'->>'at')::timestamptz>now()-interval '2 minutes' then raise exception 'document_page_busy';end if;
 update public.document_runs set claims=jsonb_set(claims,array['$extraction'],jsonb_build_object('token',t,'at',now())),updated_at=now() where id=r.id;
 return jsonb_build_object('cached',false,'token',t);
end $$;
create function public.finish_document_run(p_run_id uuid,p_extraction jsonb,p_token uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_runs;s jsonb;f jsonb;n integer;begin
 select * into r from public.document_runs where id=p_run_id;
 if r.id is null or not archive_private.can_process_document(r.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into r from public.document_runs where id=p_run_id for update;
 if r.status='complete' then return;end if;
 if r.status<>'processing' or r.source_version is distinct from archive_private.document_snapshot(r.item_id)->>'version' then raise exception 'document_source_changed';end if;
 if (select count(*) from public.transcriptions where document_run_id=r.id)<>jsonb_array_length(r.source_manifest) then raise exception 'document_pages_incomplete';end if;
 if p_token is null or (r.claims->'$extraction'->>'token') is distinct from p_token::text then raise exception 'stale_document_page';end if;
 if p_extraction is null or length(p_extraction::text)>300000 or jsonb_typeof(p_extraction->'suggestions') is distinct from 'array' or jsonb_array_length(p_extraction->'suggestions')>60 then raise exception 'invalid_document_suggestions';end if;
 if r.operation='translate' and jsonb_array_length(p_extraction->'suggestions')<>0 then raise exception 'translation_suggestions_forbidden';end if;
 for s in select * from jsonb_array_elements(p_extraction->'suggestions') loop
  if s->>'kind' not in ('person','place','date','sender','recipient','summary','topic') or length(coalesce(s->>'value','')) not between 1 and 2000 or length(coalesce(s->>'evidence','')) not between 1 and 2000 or length(coalesce(s->>'context',''))>300 then raise exception 'invalid_document_suggestion';end if;
  n:=(s->>'page')::integer;
  if n is null or n not between 1 and jsonb_array_length(r.source_manifest) then raise exception 'invalid_document_page';end if;
  f:=r.source_manifest->(n-1);
  insert into public.metadata_suggestions(archive_id,item_id,source_file_id,field_path,suggested_value,provider,model,document_run_id)
  values(r.archive_id,r.item_id,(f->>'id')::uuid,'document.'||(s->>'kind'),s,r.provider,coalesce(nullif(p_extraction#>>'{receipt,model}',''),r.model),r.id);
 end loop;
 update public.document_runs set status='complete',output=output||jsonb_build_object('extraction',p_extraction),updated_at=now(),completed_at=now(),claims='{}' where id=r.id;
 update public.processing_jobs set status='needs_review',error_code=null,updated_at=now() where item_id=r.item_id and stage='document_'||r.operation;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(r.archive_id,r.item_id,auth.uid(),'document_run_complete',jsonb_build_object('run_id',r.id,'source_version',r.source_version,'provider',r.provider,'model',r.model),'ai_suggested');
end $$;
create function public.set_document_run_state(p_run_id uuid,p_resume boolean,p_error text default 'interrupted') returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_runs;begin
 select * into r from public.document_runs where id=p_run_id;
 if r.id is null or not archive_private.can_process_document(r.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into r from public.document_runs where id=p_run_id for update;
 if r.status='complete' then return;end if;
 if p_resume then
  if r.source_version is distinct from archive_private.document_snapshot(r.item_id)->>'version' then raise exception 'document_source_changed';end if;
  if exists(select 1 from public.document_runs where item_id=r.item_id and id<>r.id and status='processing' and updated_at>now()-interval '3 minutes') then raise exception 'document_busy';end if;
  if r.status='processing' and exists(select 1 from jsonb_each(r.claims) c where (c.value->>'at')::timestamptz>now()-interval '2 minutes') then raise exception 'document_page_busy';end if;
 end if;
 if p_error is null or p_error !~ '^[a-z][a-z0-9_]{0,79}$' then raise exception 'invalid_error_code';end if;
 update public.document_runs set status=case when p_resume then 'processing' else 'failed' end,error_code=case when p_resume then null else p_error end,claims='{}',updated_at=now() where id=r.id;
 update public.processing_jobs set status=case when p_resume then 'processing' else 'failed' end,error_code=case when p_resume then null else p_error end,updated_at=now() where item_id=r.item_id and stage='document_'||r.operation;
end $$;
create function public.review_document_page(p_transcription_id uuid,p_text text,p_revision integer) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.transcriptions;begin
 select * into t from public.transcriptions where id=p_transcription_id;
 if t.id is null or t.document_run_id is null then raise exception 'permission_denied' using errcode='42501';end if;
 perform 1 from public.archive_items where id=t.item_id for no key update;
 select * into t from public.transcriptions where id=p_transcription_id for update;
 if not archive_private.can_access(t.archive_id,'editor') or not archive_private.item_readable(t.archive_id,t.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_revision is distinct from t.review_revision then raise exception 'transcription_changed_reload' using errcode='40001';end if;
 if p_text is null or length(p_text)>50000 then raise exception 'invalid_transcription';end if;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(t.archive_id,t.item_id,auth.uid(),'document_text_review',jsonb_build_object('transcription_id',t.id,'run_id',t.document_run_id,'before',t.reviewed_text,'after',p_text,'revision',t.review_revision+1),'family_reported');
 update public.transcriptions set reviewed_text=p_text,review_status='reviewed',reviewed_by=auth.uid(),reviewed_at=now(),review_revision=review_revision+1 where id=t.id;
end $$;
revoke all on function archive_private.document_snapshot(uuid),archive_private.can_process_document(uuid) from public,anon,authenticated;
revoke all on function public.document_snapshot(uuid),public.begin_document_run(uuid,uuid,text,text,uuid,text,text),public.claim_document_page(uuid,uuid),public.save_document_page(uuid,uuid,uuid,jsonb),public.claim_document_extraction(uuid),public.finish_document_run(uuid,jsonb,uuid),public.set_document_run_state(uuid,boolean,text),public.review_document_page(uuid,text,integer) from public,anon;
grant execute on function public.document_snapshot(uuid),public.begin_document_run(uuid,uuid,text,text,uuid,text,text),public.claim_document_page(uuid,uuid),public.save_document_page(uuid,uuid,uuid,jsonb),public.claim_document_extraction(uuid),public.finish_document_run(uuid,jsonb,uuid),public.set_document_run_state(uuid,boolean,text),public.review_document_page(uuid,text,integer) to authenticated;
create function public.apply_document_suggestions(p_run_id uuid,p_selections jsonb,p_expected_date jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_runs;s public.metadata_suggestions;x jsonb;v text;k text;role_name text;canonical uuid;ident uuid;decision jsonb;begin
 select * into r from public.document_runs where id=p_run_id;
 if r.id is null or not archive_private.can_access(r.archive_id,'editor') or not archive_private.can_process_document(r.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if r.status<>'complete' or r.operation<>'transcribe' or r.source_version is distinct from archive_private.document_snapshot(r.item_id)->>'version' then raise exception 'document_source_changed';end if;
 if p_selections is null or length(p_selections::text)>300000 or jsonb_typeof(p_selections) is distinct from 'array' or jsonb_array_length(p_selections) not between 1 and 60 then raise exception 'invalid_selection';end if;
 if (select count(*) from jsonb_array_elements(p_selections))<>(select count(distinct picked.value->>'id') from jsonb_array_elements(p_selections) picked(value))
 or (select count(*) from jsonb_array_elements(p_selections) picked(value) where picked.value->>'context'='written_date' and picked.value->>'action'='accept')>1 then raise exception 'invalid_selection';end if;
 for x in select * from jsonb_array_elements(p_selections) loop
  select * into s from public.metadata_suggestions where id=(x->>'id')::uuid and document_run_id=r.id and item_id=r.item_id for update;
  if s.id is null or x->>'action' not in ('accept','reject') or x->>'action' is null then raise exception 'invalid_selection';end if;
  if s.status<>'pending' then
   if s.reviewed_value=x then continue;else raise exception 'suggestion_already_reviewed';end if;
  end if;
  if x->>'action'='accept' then
   k:=s.suggested_value->>'kind';v:=trim(coalesce(x->>'value',''));role_name:=x->>'context';
   if length(v) not between 1 and 2000 then raise exception 'invalid_selection';end if;
   if k in ('person','sender','recipient') then
    if role_name is null or role_name not in ('mentioned','sender','recipient') then raise exception 'invalid_document_role';end if;
    canonical:=nullif(x->>'canonical_id','')::uuid;
    if canonical is null and coalesce((x->>'create')::boolean,false) then
     if exists(select 1 from public.people where archive_id=r.archive_id and lower(regexp_replace(trim(display_name),'\s+',' ','g'))=lower(regexp_replace(v,'\s+',' ','g'))) then raise exception 'choose_existing_person';end if;
     canonical:=public.create_identified_person(r.archive_id,r.item_id,v,'other');
    end if;
    if canonical is null then raise exception 'canonical_person_required';end if;
    ident:=public.propose_identification(r.archive_id,r.item_id,canonical,v);
    update public.identifications set role_context=case when role_name=any(regexp_split_to_array(role_context,'; *')) then role_context else concat_ws('; ',nullif(role_context,''),role_name) end where id=ident;
    perform public.review_identification(ident,'confirm');
   elsif k='place' then
    if role_name is null or role_name not in ('written_in','sent_to','related') then raise exception 'invalid_document_role';end if;
    canonical:=nullif(x->>'canonical_id','')::uuid;
    if canonical is null and coalesce((x->>'create')::boolean,false) then
     if exists(select 1 from public.places where archive_id=r.archive_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(regexp_replace(v,'\s+',' ','g'))) then raise exception 'choose_existing_place';end if;
     canonical:=archive_private.write_place(r.archive_id,null,jsonb_build_object('name',v));
    end if;
    if canonical is null then raise exception 'canonical_place_required';end if;
    ident:=public.link_item_place(r.archive_id,r.item_id,canonical,role_name,false);
    perform public.review_item_place(ident,'confirm');
   elsif k='date' then
    if role_name='written_date' then perform public.save_item_field(r.archive_id,r.item_id,'date',v,x->>'precision',p_expected_date);
    elsif role_name is distinct from 'mentioned_date' then raise exception 'invalid_document_date_role';end if;
   elsif k not in ('summary','topic') then raise exception 'invalid_selection';end if;
  end if;
  update public.metadata_suggestions set status=case when x->>'action'='accept' then 'accepted' else 'rejected' end,reviewed_value=x,reviewed_by=auth.uid(),reviewed_at=now() where id=s.id;
  insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
  values(r.archive_id,r.item_id,auth.uid(),'document_suggestion_review',jsonb_build_object('suggestion_id',s.id,'run_id',r.id,'original',s.suggested_value,'decision',x),'family_reported');
 end loop;
end $$;
create function public.order_document_pages(p_item_id uuid,p_version text,p_ids uuid[],p_roles text[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;snap jsonb;n integer;offset_value integer;f uuid;begin
 select * into i from public.archive_items where id=p_item_id for update;
 if i.id is null or not archive_private.can_access(i.archive_id,'editor') or not archive_private.can_process_document(i.id) then raise exception 'permission_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(i.id::text,9));
 if exists(select 1 from public.document_runs where item_id=i.id and status='processing' and updated_at>now()-interval '3 minutes') then raise exception 'document_busy';end if;
 snap:=archive_private.document_snapshot(i.id);n:=jsonb_array_length(snap->'pages');
 if p_version is distinct from snap->>'version' or cardinality(p_ids) is distinct from n or cardinality(p_roles) is distinct from n
 or n<>(select count(distinct x) from unnest(p_ids) x) or exists(select 1 from unnest(p_ids) x where not exists(select 1 from jsonb_array_elements(snap->'pages') p where (p->>'id')::uuid=x))
 or exists(select 1 from unnest(p_roles) x where x is null or length(x)>40) then raise exception 'document_source_changed';end if;
 select coalesce(max(page_order),0)+100 into offset_value from public.archive_item_files where item_id=i.id;
 update public.archive_item_files set page_order=page_order+offset_value where item_id=i.id and (id=any(p_ids) or parent_original_id=any(p_ids));
 for n in 1..cardinality(p_ids) loop
  f:=p_ids[n];
  update public.archive_item_files set page_order=n-1,page_role=case when id=f then p_roles[n] else page_role end where item_id=i.id and (id=f or parent_original_id=f);
 end loop;
 update public.archive_items set updated_at=now(),last_edited_by=auth.uid() where id=i.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(i.archive_id,i.id,auth.uid(),'document_page_order',jsonb_build_object('before',snap,'after',archive_private.document_snapshot(i.id)),'family_reported');
end $$;
-- Legacy review callers still advance the new revision and retain correction history for document rows.
create or replace function public.review_transcription(p_archive_id uuid,p_id uuid,p_text text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.transcriptions;begin
 select * into t from public.transcriptions where archive_id=p_archive_id and id=p_id;
 if t.id is null or not archive_private.can_access(p_archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 if t.document_run_id is not null then perform public.review_document_page(t.id,p_text,t.review_revision);return;end if;
 update public.transcriptions set reviewed_text=p_text,review_status='reviewed',reviewed_by=auth.uid(),reviewed_at=now() where archive_id=p_archive_id and id=p_id;
 insert into public.activity_log(archive_id,actor_id,event_type,summary) values(p_archive_id,auth.uid(),'transcription_reviewed','Reviewed text saved; raw provider output unchanged.');
end $$;
create or replace function archive_private.guard_item_update() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if old.lifecycle='deleting' then raise exception 'item_deletion_in_progress';end if;
 if old.archived_at is null and new.archived_at is not null and exists(select 1 from public.document_runs where item_id=old.id and status='processing' and updated_at>now()-interval '3 minutes') then raise exception 'document_busy';end if;
 return new;
end $$;
revoke all on function public.apply_document_suggestions(uuid,jsonb,jsonb),public.order_document_pages(uuid,text,uuid[],text[]) from public,anon;
grant execute on function public.apply_document_suggestions(uuid,jsonb,jsonb),public.order_document_pages(uuid,text,uuid[],text[]) to authenticated;

create or replace function public.begin_item_deletion(p_item_id uuid,p_version text,p_confirmation text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;snap jsonb;d public.item_deletions;bad text;begin
 select * into i from public.archive_items where id=p_item_id for no key update;
 if i.id is null or not archive_private.can_access(i.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_item_id::text,9));
 if p_confirmation is distinct from 'DELETE' then raise exception 'confirmation_required';end if;
 select * into d from public.item_deletions where item_id=i.id;
 if d.status='pending' and i.lifecycle='deleting' then return to_jsonb(d);end if;
 if i.archived_at is null or i.ingestion_status<>'ready' then raise exception 'archive_before_delete';end if;
 if exists(select 1 from public.archive_items where split_from=i.id) then raise exception 'split_context_has_children';end if;
 if exists(select 1 from public.document_runs where item_id=i.id and status='processing' and updated_at>now()-interval '3 minutes') then raise exception 'document_busy';end if;
 if exists(select 1 from public.preview_attempts where item_id=i.id and updated_at>now()-interval '75 seconds') then raise exception 'preview_recently_active';end if;
 -- Unknown future dependencies must be reviewed BEFORE any Storage deletion.
 select c.conrelid::regclass::text into bad from pg_constraint c where c.contype='f' and c.confrelid in ('public.archive_items'::regclass,'public.archive_item_files'::regclass,'public.recollections'::regclass,'public.recollection_audio'::regclass,'public.transcriptions'::regclass,'public.metadata_suggestions'::regclass,'public.comments'::regclass,'public.identifications'::regclass,'public.processing_jobs'::regclass,'public.provenance'::regclass,'public.preview_attempts'::regclass,'public.image_sets'::regclass,'public.import_batch_items'::regclass,'public.item_places'::regclass,'public.document_runs'::regclass)
 and c.conrelid not in (select t.oid from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=any(array['archive_items','archive_item_files','archives','people','recollections','recollection_audio','transcriptions','metadata_suggestions','comments','identifications','processing_jobs','activity_log','provenance','import_batch_items','preview_attempts','image_sets','item_places','document_runs','audio_item_links','audio_people'])) limit 1;
 if bad is not null then raise exception 'unreviewed_dependency';end if;
 if exists(select 1 from public.recollection_audio r where r.recollection_id in (select id from public.recollections where item_id=i.id)
 and r.original_file_id not in (select id from public.archive_item_files where item_id=i.id)) then raise exception 'cross_item_audio_dependency';end if;
 if exists(select 1 from public.recollection_audio r where r.original_file_id in (select id from public.archive_item_files where item_id=i.id)
 and r.recollection_id not in (select id from public.recollections where item_id=i.id)) then raise exception 'cross_item_audio_dependency';end if;
 if exists(select 1 from public.transcriptions where original_file_id in (select id from public.archive_item_files where item_id=i.id) and item_id<>i.id) then raise exception 'cross_item_source_dependency';end if;
 snap:=public.item_management_snapshot(i.id);
 if p_version is distinct from (snap->>'version') then raise exception 'item_changed_review_again';end if;
 insert into public.item_deletions(archive_id,item_id,actor_id,manifest,remaining,counts) values(i.archive_id,i.id,auth.uid(),snap->'files',snap->'files',snap->'counts') returning * into d;
 update public.archive_items set lifecycle='deleting',updated_at=now() where id=i.id;
 insert into public.item_management_events(archive_id,item_id,actor_id,event,counts) values(i.archive_id,i.id,auth.uid(),'deletion_started',d.counts);
 return to_jsonb(d);
end $$;
commit;
