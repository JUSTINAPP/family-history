begin;
-- Explicitly invoked management only. No historical rows or Storage objects are changed on installation.
alter table public.archive_items add column archived_at timestamptz;
alter table public.archive_items add column archived_by uuid references public.profiles(id);
alter table public.archive_items add column lifecycle text not null default 'active' check(lifecycle in ('active','deleting'));
alter table public.archive_items add column grouping_kind text not null default 'single_object' check(grouping_kind in ('single_object','separate_photograph','split_context'));
alter table public.archive_items add column split_from uuid;
alter table public.archive_items add foreign key(archive_id,split_from) references public.archive_items(archive_id,id);
alter table public.archive_item_files add column variant text not null default 'legacy';
alter table public.archive_item_files drop constraint item_file_purpose_order;
alter table public.archive_item_files add constraint item_file_variant_order unique(item_id,page_order,purpose,variant);
drop index public.one_display_per_source;
create unique index derivative_variant_once on public.archive_item_files(parent_original_id,purpose,variant) where parent_original_id is not null;
-- Moving source and derived ownership in one transaction must not break the same-item parent FK midway.
do $$ declare c text;begin
 for c in select conname from pg_constraint where conrelid='public.archive_item_files'::regclass and confrelid=conrelid and contype='f' loop
 execute format('alter table public.archive_item_files alter constraint %I deferrable initially deferred',c);end loop;
end $$;

create table public.image_sets (
 id uuid primary key default gen_random_uuid(),archive_id uuid not null,item_id uuid not null,original_file_id uuid not null,
 status text not null default 'reserved' check(status in ('reserved','stored')),
 generator text not null default 'responsive-v1',manifest jsonb not null,placeholder text not null check(length(placeholder)<=3000),
 display_file_id uuid not null,thumbnail_file_id uuid not null,small_file_id uuid not null,
 created_at timestamptz not null default now(),completed_at timestamptz,
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id),
 foreign key(archive_id,item_id,original_file_id) references public.archive_item_files(archive_id,item_id,id) deferrable initially deferred,
 foreign key(archive_id,display_file_id) references public.archive_item_files(archive_id,id) deferrable initially deferred,
 foreign key(archive_id,thumbnail_file_id) references public.archive_item_files(archive_id,id) deferrable initially deferred,
 foreign key(archive_id,small_file_id) references public.archive_item_files(archive_id,id) deferrable initially deferred
);
create index image_sets_source on public.image_sets(original_file_id,status,created_at desc);
create view public.current_image_sets with(security_invoker=true) as select distinct on (original_file_id) * from public.image_sets where status='stored' order by original_file_id,created_at desc,id desc;
revoke all on public.current_image_sets from public,anon,authenticated;
grant select on public.current_image_sets to authenticated;
create table public.item_management_events (
 id uuid primary key default gen_random_uuid(),archive_id uuid not null references public.archives(id),item_id uuid not null,
 actor_id uuid references public.profiles(id) on delete set null,event text not null,counts jsonb not null default '{}',created_at timestamptz not null default now()
);
create table public.item_deletions (
 id uuid primary key default gen_random_uuid(),archive_id uuid not null references public.archives(id),item_id uuid not null unique,
 actor_id uuid references public.profiles(id),status text not null default 'pending' check(status in ('pending','complete')),
 manifest jsonb not null,remaining jsonb not null,counts jsonb not null,created_at timestamptz not null default now(),completed_at timestamptz
);
do $$declare t text;begin
 foreach t in array array['image_sets','item_management_events','item_deletions'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('alter table public.%I force row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy image_set_read on public.image_sets for select to authenticated using(archive_private.item_readable(archive_id,item_id));
create policy management_event_read on public.item_management_events for select to authenticated using(archive_private.can_access(archive_id,'editor'));
create policy deletion_read on public.item_deletions for select to authenticated using(archive_private.can_access(archive_id,'editor'));

create or replace function archive_private.item_readable(a uuid,i uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select archive_private.can_access(a) and exists(select 1 from public.archive_items x where x.archive_id=a and x.id=i
 and x.lifecycle='active' and (x.archived_at is null or archive_private.can_access(a,'editor'))
 and (x.ingestion_status='ready' or x.contributed_by=auth.uid() or archive_private.can_access(a,'editor'))
 and (archive_private.can_access(a,'editor') or not exists(select 1 from public.recollection_audio r join public.archive_item_files f on f.id=r.original_file_id
 where (to_jsonb(r)->>'standalone')::boolean and f.item_id=x.id and to_jsonb(r)->>'archived_at' is not null)))
$$;
-- Shared advisory locks serialize Storage INSERT authorization with exclusive split/delete preparation.
create or replace function archive_private.can_prepare_preview(f uuid) returns boolean language plpgsql volatile security definer set search_path=public,pg_temp as $$
declare s public.archive_item_files;begin
 select * into s from public.archive_item_files where id=f;
 if s.id is null then return false;end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(s.item_id::text,9));
 return exists(select 1 from public.archive_items i where i.id=s.item_id and i.archive_id=s.archive_id and i.lifecycle='active'
 and s.purpose='original' and s.status='stored' and i.ingestion_status='ready'
 and (archive_private.can_access(s.archive_id,'editor') or (i.archived_at is null and archive_private.can_access(s.archive_id,'contributor') and i.contributed_by=auth.uid())));
end $$;

create function public.reserve_image_set(p_source_id uuid,p_manifest jsonb,p_placeholder text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.archive_item_files; g uuid; d uuid:=gen_random_uuid();t uuid:=gen_random_uuid();m uuid:=gen_random_uuid(); k text;v jsonb;fid uuid;begin
 if not archive_private.can_prepare_preview(p_source_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into s from public.archive_item_files where id=p_source_id for update;
 if p_placeholder is null or length(p_placeholder)>3000 or p_placeholder !~ '^data:image/webp;base64,[A-Za-z0-9+/=]+$' then raise exception 'invalid_placeholder';end if;
 foreach k in array array['display','thumbnail','small'] loop
 v:=p_manifest->k;
 if v is null or (v->>'sha256') is null or (v->>'sha256') !~ '^[a-f0-9]{64}$'
 or coalesce((v->>'size')::bigint,0) not between 1 and 10485760
 or coalesce((v->>'width')::integer,0) not between 1 and (case k when 'display' then 2400 when 'thumbnail' then 1200 else 600 end)
 or coalesce((v->>'height')::integer,0) not between 1 and (case k when 'display' then 2400 when 'thumbnail' then 1200 else 600 end)
 or v->>'mime' is distinct from (case k when 'display' then 'image/jpeg' else 'image/webp' end) then raise exception 'invalid_image_variant';end if;
 end loop;
 select id into g from public.image_sets where original_file_id=s.id and status='reserved' and manifest=p_manifest and placeholder=p_placeholder order by created_at limit 1;
 if found then return g;end if;
 g:=gen_random_uuid();
 foreach k in array array['display','thumbnail','small'] loop
 v:=p_manifest->k;fid:=case k when 'display' then d when 'thumbnail' then t else m end;
 insert into public.archive_item_files(id,archive_id,item_id,purpose,parent_original_id,bucket_id,storage_path,original_filename,mime_type,byte_size,sha256,width,height,page_order,page_role,uploaded_by,variant)
 values(fid,s.archive_id,s.item_id,case k when 'display' then 'display' else 'thumbnail' end,s.id,'archive-derived',s.archive_id::text||'/'||s.item_id::text||'/'||fid::text,k, v->>'mime',(v->>'size')::bigint,v->>'sha256',(v->>'width')::integer,(v->>'height')::integer,s.page_order,k,auth.uid(),g::text||':'||k);
 end loop;
 insert into public.image_sets(id,archive_id,item_id,original_file_id,manifest,placeholder,display_file_id,thumbnail_file_id,small_file_id)
 values(g,s.archive_id,s.item_id,s.id,p_manifest,p_placeholder,d,t,m);return g;
end $$;
create policy archive_thumbnail_insert on storage.objects for insert to authenticated with check(
 bucket_id='archive-derived' and exists(select 1 from public.archive_item_files f where f.bucket_id=storage.objects.bucket_id and f.storage_path=storage.objects.name
 and f.purpose='thumbnail' and f.status='reserved' and archive_private.can_prepare_preview(f.parent_original_id)));
create function archive_private.refresh_image_job(p_item_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update public.processing_jobs set updated_at=now(),status=case
 when not exists(select 1 from public.archive_item_files f where f.item_id=p_item_id and f.purpose='original' and not (
 exists(select 1 from public.image_sets g where g.original_file_id=f.id and g.status='stored') or
 (not exists(select 1 from public.image_sets g where g.item_id=p_item_id) and exists(select 1 from public.archive_item_files d where d.parent_original_id=f.id and d.purpose='display' and d.status='stored')))) then 'complete'
 when exists(select 1 from public.preview_attempts where item_id=p_item_id and status='failed') then 'failed'
 when exists(select 1 from public.preview_attempts where item_id=p_item_id and status='processing') then 'processing' else 'queued' end,
 error_code=(select error_code from public.preview_attempts where item_id=p_item_id and status='failed' order by updated_at desc limit 1)
 where item_id=p_item_id and stage='create_display_derivatives';
end $$;
revoke all on function archive_private.refresh_image_job(uuid) from public,anon,authenticated;
create or replace function public.record_preview_attempt(p_source_id uuid,p_attempt_id uuid,p_stage text,p_error_code text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.preview_attempts;begin
 if not archive_private.can_prepare_preview(p_source_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into a from public.preview_attempts where original_file_id=p_source_id for update;
 if a.attempt_id is distinct from p_attempt_id then raise exception 'stale_preview_attempt' using errcode='40001';end if;
 if a.status<>'processing' then raise exception 'preview_attempt_finished';end if;
 if p_stage is null or p_stage not in ('download','integrity','decode','reserve','upload','complete') or (p_error_code is not null and p_error_code !~ '^[a-z][a-z0-9_]{0,79}$') then raise exception 'invalid_preview_state';end if;
 if p_stage='complete' and p_error_code is null and not exists(select 1 from public.archive_item_files where parent_original_id=p_source_id and purpose='display' and status='stored') then raise exception 'preview_receipt_missing';end if;
 update public.preview_attempts set stage=p_stage,error_code=p_error_code,status=case when p_error_code is not null then 'failed' when p_stage='complete' then 'complete' else 'processing' end,updated_at=now() where original_file_id=p_source_id;
 perform archive_private.refresh_image_job(a.item_id);
end $$;
create function public.complete_image_set(p_set_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare g public.image_sets;begin
 select * into g from public.image_sets where id=p_set_id for update;
 if g.id is null or not archive_private.can_prepare_preview(g.original_file_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if g.status='stored' then return;end if;
 if exists(select 1 from public.archive_item_files f where f.id in (g.display_file_id,g.thumbnail_file_id,g.small_file_id) and not exists(
 select 1 from storage.objects o where o.bucket_id=f.bucket_id and o.name=f.storage_path and (o.metadata->>'size')::bigint=f.byte_size and o.metadata->>'mimetype'=f.mime_type)) then raise exception 'upload_incomplete';end if;
 update public.archive_item_files set status='stored' where id in (g.display_file_id,g.thumbnail_file_id,g.small_file_id);
 update public.image_sets set status='stored',completed_at=now() where id=g.id;
 perform archive_private.refresh_image_job(g.item_id);
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(g.archive_id,g.item_id,auth.uid(),'image_set',jsonb_build_object('set_id',g.id,'original_file_id',g.original_file_id,'manifest',g.manifest),'family_reported');
end $$;

create function archive_private.guard_item_content() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform pg_advisory_xact_lock_shared(hashtextextended(new.item_id::text,9));
 if exists(select 1 from public.archive_items where id=new.item_id and lifecycle='deleting') then raise exception 'item_deletion_in_progress';end if;
 if tg_table_name='archive_item_files' then
 if new.purpose='original' and exists(select 1 from public.archive_items where id=new.item_id and grouping_kind='separate_photograph')
 and exists(select 1 from public.archive_item_files where item_id=new.item_id and purpose='original' and id<>new.id) then raise exception 'one_original_per_photograph';end if;
 end if;
 return new;
end $$;
do $$declare t text;begin
 foreach t in array array['archive_item_files','recollections','transcriptions','metadata_suggestions','comments','identifications','processing_jobs','provenance','preview_attempts','image_sets','import_batch_items'] loop
 execute format('create trigger guard_item_lifecycle before insert or update on public.%I for each row execute function archive_private.guard_item_content()',t);end loop;
end $$;
create function archive_private.guard_item_update() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin if old.lifecycle='deleting' then raise exception 'item_deletion_in_progress';end if;return new;end $$;
create trigger guard_item_update before update on public.archive_items for each row execute function archive_private.guard_item_update();
create function archive_private.mark_batch_photograph() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if (select count(*) from public.archive_item_files where item_id=new.item_id and purpose='original')<>1
 or not exists(select 1 from public.archive_items where id=new.item_id and kind='Photograph') then raise exception 'one_original_per_photograph';end if;
 update public.archive_items set grouping_kind='separate_photograph' where id=new.item_id;return new;
end $$;
create trigger mark_batch_photo before insert on public.import_batch_items for each row execute function archive_private.mark_batch_photograph();

create function public.item_management_snapshot(p_item_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;files jsonb;counts jsonb;version text;begin
 select * into i from public.archive_items where id=p_item_id;
 if i.id is null or not archive_private.can_access(i.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'bucket',f.bucket_id,'path',f.storage_path,'name',f.original_filename,'purpose',f.purpose,'size',f.byte_size,'sha256',f.sha256,'width',f.width,'height',f.height,'mime',f.mime_type,'status',f.status) order by f.id),'[]') into files from public.archive_item_files f where f.item_id=i.id;
 counts:=jsonb_build_object('originals',(select count(*) from public.archive_item_files where item_id=i.id and purpose in ('original','audio_original')),
 'derivatives',(select count(*) from public.archive_item_files where item_id=i.id and parent_original_id is not null),
 'recollections',(select count(*) from public.recollections where item_id=i.id),'comments',(select count(*) from public.comments where item_id=i.id),
 'transcriptions',(select count(*) from public.transcriptions where item_id=i.id),'provenance',(select count(*) from public.provenance where item_id=i.id));
 version:=md5(to_jsonb(i)::text||files::text||counts::text);
 return jsonb_build_object('item',to_jsonb(i),'files',files,'counts',counts,'version',version,
 'children',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title)) from public.archive_items where split_from=i.id),'[]'),
 'deletion',(select to_jsonb(d) from public.item_deletions d where d.item_id=i.id));
end $$;
create function public.set_item_archived(p_item_id uuid,p_archived boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;begin
 select * into i from public.archive_items where id=p_item_id for update;
 if i.id is null or not archive_private.can_access(i.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 if p_archived is null or i.lifecycle<>'active' or (not p_archived and i.grouping_kind='split_context') then raise exception 'item_state_conflict';end if;
 update public.archive_items set archived_at=case when p_archived then now() else null end,archived_by=case when p_archived then auth.uid() else null end,updated_at=now() where id=i.id;
 insert into public.item_management_events(archive_id,item_id,actor_id,event) values(i.archive_id,i.id,auth.uid(),case when p_archived then 'archived' else 'restored' end);
end $$;
create function public.split_photographs(p_item_id uuid,p_version text,p_confirmation text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;s public.archive_item_files;child uuid;children jsonb:='[]';begin
 select * into i from public.archive_items where id=p_item_id for no key update;
 if i.id is null or not archive_private.can_access(i.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_item_id::text,9));
 if p_confirmation is distinct from 'SPLIT' or p_version is distinct from (public.item_management_snapshot(i.id)->>'version') then raise exception 'confirmation_or_version_required';end if;
 if i.kind<>'Photograph' or i.grouping_kind<>'single_object' or i.lifecycle<>'active' or i.ingestion_status<>'ready'
 or (select count(*) from public.archive_item_files where item_id=i.id and purpose='original')<2
 or exists(select 1 from public.archive_item_files where item_id=i.id and purpose='original' and status<>'stored')
 or exists(select 1 from public.archive_item_files where item_id=i.id and purpose='audio_original') then raise exception 'not_a_grouped_photograph';end if;
 if exists(select 1 from public.preview_attempts where item_id=i.id and status='processing' and started_at>now()-interval '75 seconds') then raise exception 'preview_busy';end if;
 for s in select * from public.archive_item_files where item_id=i.id and purpose='original' order by page_order for update loop
 child:=gen_random_uuid();
 insert into public.archive_items(id,archive_id,client_capture_id,title,kind,contributed_by,ingestion_status,grouping_kind,split_from)
 values(child,i.archive_id,gen_random_uuid(),'Photograph, still to be catalogued','Photograph',i.contributed_by,'ready','separate_photograph',i.id);
 update public.archive_item_files set item_id=child,page_order=0 where id=s.id or parent_original_id=s.id;
 update public.image_sets set item_id=child where original_file_id=s.id;
 update public.preview_attempts set item_id=child where original_file_id=s.id;
 update public.transcriptions set item_id=child where original_file_id=s.id;
 insert into public.processing_jobs(archive_id,item_id,stage,status) values(i.archive_id,child,'create_display_derivatives',
 case when exists(select 1 from public.image_sets where original_file_id=s.id and status='stored') then 'complete' else 'queued' end);
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(i.archive_id,child,auth.uid(),'split_from',jsonb_build_object('item_id',i.id,'original_file_id',s.id,'original_sha256',s.sha256,'metadata_policy','retained_on_context_item'),'family_reported');
 children:=children||jsonb_build_array(child);
 end loop;
 update public.archive_items set archived_at=coalesce(archived_at,now()),archived_by=auth.uid(),grouping_kind='split_context',updated_at=now() where id=i.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(i.archive_id,i.id,auth.uid(),'split_children',children,'family_reported');
 insert into public.item_management_events(archive_id,item_id,actor_id,event,counts) values(i.archive_id,i.id,auth.uid(),'split',jsonb_build_object('children',children));
 return children;
end $$;

create function public.begin_item_deletion(p_item_id uuid,p_version text,p_confirmation text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;snap jsonb;d public.item_deletions;bad text;begin
 select * into i from public.archive_items where id=p_item_id for no key update;
 if i.id is null or not archive_private.can_access(i.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_item_id::text,9));
 if p_confirmation is distinct from 'DELETE' then raise exception 'confirmation_required';end if;
 select * into d from public.item_deletions where item_id=i.id;
 if d.status='pending' and i.lifecycle='deleting' then return to_jsonb(d);end if;
 if i.archived_at is null or i.ingestion_status<>'ready' then raise exception 'archive_before_delete';end if;
 if exists(select 1 from public.archive_items where split_from=i.id) then raise exception 'split_context_has_children';end if;
 if exists(select 1 from public.preview_attempts where item_id=i.id and updated_at>now()-interval '75 seconds') then raise exception 'preview_recently_active';end if;
 -- Unknown future dependencies must be reviewed BEFORE any Storage deletion.
 select c.conrelid::regclass::text into bad from pg_constraint c where c.contype='f' and c.confrelid in ('public.archive_items'::regclass,'public.archive_item_files'::regclass,'public.recollections'::regclass,'public.recollection_audio'::regclass,'public.transcriptions'::regclass,'public.metadata_suggestions'::regclass,'public.comments'::regclass,'public.identifications'::regclass,'public.processing_jobs'::regclass,'public.provenance'::regclass,'public.preview_attempts'::regclass,'public.image_sets'::regclass,'public.import_batch_items'::regclass)
 and c.conrelid not in (select t.oid from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=any(array['archive_items','archive_item_files','archives','people','recollections','recollection_audio','transcriptions','metadata_suggestions','comments','identifications','processing_jobs','activity_log','provenance','import_batch_items','preview_attempts','image_sets','audio_item_links','audio_people'])) limit 1;
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
create function archive_private.can_delete_item_object(b text,p text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.item_deletions d cross join lateral jsonb_array_elements(d.manifest) f
 where d.status='pending' and f->>'bucket'=b and f->>'path'=p and archive_private.can_access(d.archive_id,'editor'))
$$;
revoke all on function archive_private.can_delete_item_object(text,text) from public,anon;
grant execute on function archive_private.can_delete_item_object(text,text) to authenticated;
create policy confirmed_item_object_delete on storage.objects for delete to authenticated using(archive_private.can_delete_item_object(bucket_id,name));
create or replace function archive_private.can_read_object(b text,p text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select archive_private.can_delete_item_object(b,p) or exists(select 1 from public.archive_item_files f where f.bucket_id=b and f.storage_path=p
 and archive_private.item_readable(f.archive_id,f.item_id)
 and (f.status='stored' or f.uploaded_by=auth.uid() or (f.purpose in ('display','thumbnail') and archive_private.can_prepare_preview(f.parent_original_id)))
 and (f.purpose<>'audio_original' or exists(select 1 from public.recollection_audio r where r.original_file_id=f.id and (to_jsonb(r)->>'archived_at' is null or archive_private.can_access(f.archive_id,'editor')))))
$$;
create function public.checkpoint_item_deletion(p_deletion_id uuid,p_file_ids uuid[]) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.item_deletions;begin
 if p_file_ids is null or cardinality(p_file_ids) not between 1 and 100 then raise exception 'invalid_delete_batch';end if;
 select * into d from public.item_deletions where id=p_deletion_id for update;
 if d.id is null or not archive_private.can_access(d.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 if exists(select 1 from unnest(p_file_ids) f where not exists(select 1 from jsonb_array_elements(d.manifest) m where (m->>'id')::uuid=f)) then raise exception 'invalid_delete_batch';end if;
 if exists(select 1 from storage.objects o cross join jsonb_array_elements(d.manifest) f where (f->>'id')::uuid=any(p_file_ids) and o.bucket_id=f->>'bucket' and o.name=f->>'path') then raise exception 'storage_cleanup_incomplete';end if;
 update public.item_deletions set remaining=coalesce((select jsonb_agg(f) from jsonb_array_elements(d.remaining) f where not ((f->>'id')::uuid=any(p_file_ids))),'[]') where id=d.id;
end $$;
create function public.finish_item_deletion(p_deletion_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.item_deletions;files uuid[];words uuid[];begin
 select * into d from public.item_deletions where id=p_deletion_id for update;
 if d.id is null or not archive_private.can_access(d.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 if d.status='complete' then return d.archive_id;end if;
 if exists(select 1 from storage.objects o cross join jsonb_array_elements(d.manifest) f where o.bucket_id=f->>'bucket' and o.name=f->>'path') then raise exception 'storage_cleanup_incomplete';end if;
 select coalesce(array_agg(id),'{}') into files from public.archive_item_files where item_id=d.item_id;
 select coalesce(array_agg(id),'{}') into words from public.recollections where item_id=d.item_id;
 update public.archives set cover_file_id=null where id=d.archive_id and cover_file_id=any(files);
 update public.people set portrait_file_id=null where archive_id=d.archive_id and portrait_file_id=any(files);
 -- Preserve other items' words/history while removing links to explicitly deleted source material.
 update public.metadata_suggestions set source_file_id=null where source_file_id=any(files) and item_id<>d.item_id;
 update public.metadata_suggestions set source_recollection_id=null where source_recollection_id=any(words) and item_id<>d.item_id;
 update public.provenance set source_recollection_id=null where source_recollection_id=any(words) and item_id is distinct from d.item_id;
 if to_regclass('public.audio_people') is not null then
 execute 'delete from public.audio_people where recording_id in (select id from public.recollection_audio where original_file_id=any($1) or recollection_id=any($2))' using files,words;
 execute 'delete from public.audio_item_links where item_id=$1 or recording_id in (select id from public.recollection_audio where original_file_id=any($2) or recollection_id=any($3))' using d.item_id,files,words;
 end if;
 delete from public.recollection_audio where original_file_id=any(files) or recollection_id=any(words);
 delete from public.transcriptions where item_id=d.item_id or original_file_id=any(files);
 delete from public.metadata_suggestions where item_id=d.item_id;
 delete from public.comments where item_id=d.item_id;
 delete from public.identifications where item_id=d.item_id;
 delete from public.processing_jobs where item_id=d.item_id;
 delete from public.activity_log where item_id=d.item_id;
 delete from public.provenance where item_id=d.item_id;
 delete from public.recollections where item_id=d.item_id;
 delete from public.import_batch_items where item_id=d.item_id;
 delete from public.preview_attempts where item_id=d.item_id;
 delete from public.image_sets where item_id=d.item_id;
 delete from public.archive_item_files where item_id=d.item_id;
 delete from public.archive_items where id=d.item_id;
 update public.item_deletions set status='complete',manifest='[]',remaining='[]',completed_at=now() where id=d.id;
 insert into public.item_management_events(archive_id,item_id,actor_id,event,counts) values(d.archive_id,d.item_id,auth.uid(),'deletion_complete',d.counts);
 return d.archive_id;
end $$;
revoke all on function public.reserve_image_set(uuid,jsonb,text),public.complete_image_set(uuid),public.item_management_snapshot(uuid),public.set_item_archived(uuid,boolean),public.split_photographs(uuid,text,text),public.begin_item_deletion(uuid,text,text),public.finish_item_deletion(uuid),public.checkpoint_item_deletion(uuid,uuid[]) from public,anon;
grant execute on function public.reserve_image_set(uuid,jsonb,text),public.complete_image_set(uuid),public.item_management_snapshot(uuid),public.set_item_archived(uuid,boolean),public.split_photographs(uuid,text,text),public.begin_item_deletion(uuid,text,text),public.finish_item_deletion(uuid),public.checkpoint_item_deletion(uuid,uuid[]) to authenticated;
revoke all on function archive_private.guard_item_content(),archive_private.guard_item_update(),archive_private.mark_batch_photograph() from public,anon,authenticated;
commit;
