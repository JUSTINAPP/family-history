begin;
-- Audio reuses archive items, source files, recollections and the existing private audio bucket.
-- No source object or existing historical row is deleted/rewritten.
alter table public.archive_items drop constraint archive_items_kind_check;
alter table public.archive_items add constraint archive_items_kind_check check(kind in ('Photograph','Letter','Document','Object','Postcard','Certificate','Artwork','Other','Audio'));
alter table public.recollection_audio add column manual_transcript text check(length(manual_transcript)<=100000);
alter table public.recollection_audio add column original_mime_type text;
alter table public.recollection_audio add column title text not null default '';
alter table public.recollection_audio add column speaker_text text not null default '';
alter table public.recollection_audio add column speaker_person_id uuid;
alter table public.recollection_audio add column recorded_date text not null default '';
alter table public.recollection_audio add column date_precision text not null default 'unknown' check(date_precision in ('unknown','approximate','exact','year'));
alter table public.recollection_audio add column location text not null default '';
alter table public.recollection_audio add column description text not null default '';
alter table public.recollection_audio add column tags text[] not null default '{}';
alter table public.recollection_audio add column contributed_by uuid references public.profiles(id);
alter table public.recollection_audio add column client_capture_id uuid;
alter table public.recollection_audio add column standalone boolean not null default false;
alter table public.recollection_audio add column archived_at timestamptz;
alter table public.recollection_audio add column updated_at timestamptz not null default now();
alter table public.recollection_audio add column last_edited_by uuid references public.profiles(id);
alter table public.recollection_audio add constraint audio_speaker_fk foreign key(archive_id,speaker_person_id) references public.people(archive_id,id);
create unique index audio_capture_retry on public.recollection_audio(archive_id,contributed_by,client_capture_id);
create unique index audio_source_once on public.recollection_audio(original_file_id);
create index audio_recollection_index on public.recollection_audio(archive_id,recollection_id);

create table public.audio_people (
 archive_id uuid not null, recording_id uuid not null, person_id uuid not null,
 primary key(recording_id,person_id), foreign key(archive_id,recording_id) references public.recollection_audio(archive_id,id), foreign key(archive_id,person_id) references public.people(archive_id,id)
);
create table public.audio_item_links (
 archive_id uuid not null, recording_id uuid not null, item_id uuid not null,
 primary key(recording_id,item_id), foreign key(archive_id,recording_id) references public.recollection_audio(archive_id,id), foreign key(archive_id,item_id) references public.archive_items(archive_id,id)
);
create index audio_item_links_target on public.audio_item_links(archive_id,item_id);

create function archive_private.audio_readable(r uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.recollection_audio a join public.archive_item_files f on f.id=a.original_file_id and f.archive_id=a.archive_id
 where a.id=r and archive_private.item_readable(a.archive_id,f.item_id)
 and (a.archived_at is null or archive_private.can_access(a.archive_id,'editor'))
 and (f.status='stored' or a.contributed_by=auth.uid() or archive_private.can_access(a.archive_id,'editor')))
$$;
-- Exclude soft-archived oral histories from ordinary browse/access; images are unchanged.
create or replace function archive_private.item_readable(a uuid,i uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select archive_private.can_access(a) and exists(select 1 from public.archive_items x where x.archive_id=a and x.id=i
 and (x.ingestion_status='ready' or x.contributed_by=auth.uid() or archive_private.can_access(a,'editor'))
 and (archive_private.can_access(a,'editor') or not exists(select 1 from public.recollection_audio r join public.archive_item_files f on f.id=r.original_file_id where r.standalone and f.item_id=x.id and r.archived_at is not null)))
$$;
revoke all on function archive_private.audio_readable(uuid) from public,anon;
grant execute on function archive_private.audio_readable(uuid) to authenticated;
drop policy archive_read on public.recollection_audio;
create policy audio_read on public.recollection_audio for select to authenticated using(archive_private.audio_readable(id));
create function archive_private.recollection_readable(a uuid,r uuid,i uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select archive_private.item_readable(a,i) and not exists(select 1 from public.recollection_audio x where x.archive_id=a and x.recollection_id=r and not archive_private.audio_readable(x.id))
$$;
revoke all on function archive_private.recollection_readable(uuid,uuid,uuid) from public,anon;
grant execute on function archive_private.recollection_readable(uuid,uuid,uuid) to authenticated;
drop policy content_read on public.recollections;
create policy recollection_read on public.recollections for select to authenticated using(archive_private.recollection_readable(archive_id,id,item_id));

alter table public.audio_people enable row level security;
alter table public.audio_people force row level security;
alter table public.audio_item_links enable row level security;
alter table public.audio_item_links force row level security;
revoke all on public.audio_people,public.audio_item_links from anon,authenticated;
grant select on public.audio_people,public.audio_item_links to authenticated;
create policy audio_people_read on public.audio_people for select to authenticated using(archive_private.audio_readable(recording_id));
create policy audio_links_read on public.audio_item_links for select to authenticated using(archive_private.audio_readable(recording_id) and archive_private.item_readable(archive_id,item_id));

update storage.buckets set allowed_mime_types=array['audio/webm','audio/ogg','audio/mp4','audio/x-m4a','audio/mpeg','audio/wav','audio/x-wav'],file_size_limit=31457280,public=false where id='archive-audio';
create policy archive_audio_insert on storage.objects for insert to authenticated with check(bucket_id='archive-audio' and exists(
 select 1 from public.archive_item_files f join public.recollection_audio a on a.original_file_id=f.id and a.archive_id=f.archive_id
 where f.bucket_id=storage.objects.bucket_id and f.storage_path=storage.objects.name and f.purpose='audio_original' and f.status='reserved'
 and a.contributed_by=auth.uid() and archive_private.can_access(f.archive_id,'contributor') and archive_private.item_readable(f.archive_id,f.item_id)));
create or replace function archive_private.can_read_object(b text,p text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.archive_item_files f where f.bucket_id=b and f.storage_path=p and archive_private.item_readable(f.archive_id,f.item_id)
 and (f.status='stored' or f.uploaded_by=auth.uid() or (f.purpose='display' and archive_private.can_prepare_preview(f.parent_original_id)))
 and (f.purpose<>'audio_original' or exists(select 1 from public.recollection_audio r where r.original_file_id=f.id and archive_private.audio_readable(r.id))))
$$;

create function public.edit_audio_recording(p_recording_id uuid,p_metadata jsonb,p_people uuid[] default '{}',p_items uuid[] default '{}') returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare a public.recollection_audio; f public.archive_item_files; v_title text; begin
 select * into a from public.recollection_audio where id=p_recording_id for update;
 if a.id is null or not (archive_private.can_access(a.archive_id,'editor') or (archive_private.can_access(a.archive_id,'contributor') and a.contributed_by=auth.uid() and a.archived_at is null)) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into f from public.archive_item_files where id=a.original_file_id;
 if a.standalone and not archive_private.can_access(a.archive_id,'editor') and exists(select 1 from public.archive_items where id=f.item_id and evidence_status='verified') then raise exception 'editor_required' using errcode='42501';end if;
 if jsonb_typeof(p_metadata)<>'object' or length(p_metadata::text)>30000 or cardinality(p_people)>100 or cardinality(p_items)>100 then raise exception 'invalid_metadata';end if;
 if exists(select 1 from unnest(p_people) p where not exists(select 1 from public.people where id=p and archive_id=a.archive_id))
 or exists(select 1 from unnest(p_items) p where not archive_private.item_readable(a.archive_id,p)) then raise exception 'foreign_archive_link';end if;
 v_title:=coalesce(nullif(trim(p_metadata->>'title'),''),nullif(concat_ws(' · ',nullif(trim(p_metadata->>'speaker'),''),nullif(trim(p_metadata->>'recordedDate'),'')),''),'Voice recording');
 if length(v_title)>300 or length(coalesce(p_metadata->>'description',''))>20000 or length(coalesce(p_metadata->>'speaker',''))>300 or length(coalesce(p_metadata->>'location',''))>1000 or length(coalesce(p_metadata->>'recordedDate',''))>300 then raise exception 'invalid_metadata';end if;
 if p_metadata ? 'tags' and (jsonb_typeof(p_metadata->'tags')<>'array' or jsonb_array_length(p_metadata->'tags')>30) then raise exception 'invalid_tags';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(p_metadata->'tags','[]')) t where length(t)>80) then raise exception 'invalid_tags';end if;
 update public.recollection_audio set title=v_title,speaker_text=coalesce(p_metadata->>'speaker',''),speaker_person_id=nullif(p_metadata->>'speakerPersonId','')::uuid,
 recorded_date=coalesce(p_metadata->>'recordedDate',''),date_precision=coalesce(nullif(p_metadata->>'precision',''),'unknown'),location=coalesce(p_metadata->>'location',''),description=coalesce(p_metadata->>'description',''),
 tags=array(select jsonb_array_elements_text(coalesce(p_metadata->'tags','[]'))),last_edited_by=auth.uid(),updated_at=now() where id=a.id;
 delete from public.audio_people where recording_id=a.id;
 insert into public.audio_people select a.archive_id,a.id,p from (select distinct unnest(p_people) p) x;
 delete from public.audio_item_links where recording_id=a.id;
 insert into public.audio_item_links select a.archive_id,a.id,p from (select distinct unnest(p_items) p) x;
 if a.standalone then update public.archive_items set title=v_title,notes=coalesce(p_metadata->>'description',''),reported_date=coalesce(p_metadata->>'recordedDate',''),date_precision=coalesce(nullif(p_metadata->>'precision',''),'unknown'),
 evidence_status='family_reported',people_text=coalesce(p_metadata->>'speaker',''),reported_place=coalesce(p_metadata->>'location',''),updated_at=now(),last_edited_by=auth.uid() where id=f.item_id;end if;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(a.archive_id,f.item_id,auth.uid(),'audio_metadata',jsonb_build_object('recording_id',a.id,'before',to_jsonb(a),'after',p_metadata,'related_people',p_people,'related_items',p_items),'family_reported');
 end
$$;

create function public.begin_audio_recording(p_archive_id uuid,p_capture_id uuid,p_item_id uuid,p_file jsonb,p_metadata jsonb,p_people uuid[] default '{}',p_items uuid[] default '{}') returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare a public.recollection_audio; item uuid:=p_item_id; fid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); aid uuid:=gen_random_uuid(); n integer; begin
 if not archive_private.can_access(p_archive_id,'contributor') then raise exception 'permission_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_archive_id::text||auth.uid()::text||p_capture_id::text,0));
 select * into a from public.recollection_audio where archive_id=p_archive_id and contributed_by=auth.uid() and client_capture_id=p_capture_id;
 if found then
 if (p_item_id is null)<>a.standalone or (p_item_id is not null and not exists(select 1 from public.archive_item_files where id=a.original_file_id and item_id=p_item_id)) then raise exception 'capture_conflict';end if;
 return a.id;end if;
 if p_capture_id is null or p_file->>'mimeType' not in ('audio/webm','audio/ogg','audio/mp4','audio/x-m4a','audio/mpeg','audio/wav','audio/x-wav') or (p_file->>'size')::bigint not between 1 and 31457280 or length(p_file->>'name') not between 1 and 255 then raise exception 'invalid_audio';end if;
 if item is null then
 insert into public.archive_items(archive_id,client_capture_id,title,kind,contributed_by) values(p_archive_id,p_capture_id,'Voice recording','Audio',auth.uid()) returning id into item;
 else
 perform 1 from public.archive_items where archive_id=p_archive_id and id=item and ingestion_status='ready' for update;
 if not found or not archive_private.item_readable(p_archive_id,item) then raise exception 'permission_denied' using errcode='42501';end if;
 end if;
 select coalesce(max(page_order)+1,0) into n from public.archive_item_files where item_id=item and purpose='audio_original';
 insert into public.archive_item_files(id,archive_id,item_id,purpose,bucket_id,storage_path,original_filename,mime_type,byte_size,sha256,page_order,page_role,uploaded_by)
 values(fid,p_archive_id,item,'audio_original','archive-audio',p_archive_id::text||'/'||item::text||'/'||fid::text,p_file->>'name',p_file->>'mimeType',(p_file->>'size')::bigint,p_file->>'sha256',n,'voice',auth.uid());
 insert into public.recollections(id,archive_id,item_id,contributor_id,original_text) values(rid,p_archive_id,item,auth.uid(),coalesce(p_metadata->>'description',''));
 insert into public.recollection_audio(id,archive_id,recollection_id,original_file_id,contributed_by,client_capture_id,standalone,duration_ms,original_mime_type) values(aid,p_archive_id,rid,fid,auth.uid(),p_capture_id,p_item_id is null,(p_file->>'durationMs')::integer,left(p_file->>'originalMime',200));
 perform public.edit_audio_recording(aid,p_metadata,p_people,p_items);
 return aid;end
$$;
create function public.complete_audio_recording(p_recording_id uuid,p_duration_ms integer default null) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare a public.recollection_audio; f public.archive_item_files; begin
 select * into a from public.recollection_audio where id=p_recording_id for update;
 if a.id is null or a.contributed_by<>auth.uid() or not archive_private.can_access(a.archive_id,'contributor') or a.archived_at is not null then raise exception 'permission_denied' using errcode='42501';end if;
 select * into f from public.archive_item_files where id=a.original_file_id;
 if f.status='stored' then return f.item_id;end if;
 if not exists(select 1 from storage.objects o where o.bucket_id=f.bucket_id and o.name=f.storage_path and (o.metadata->>'size')::bigint=f.byte_size and o.metadata->>'mimetype'=f.mime_type) then raise exception 'upload_incomplete';end if;
 update public.archive_item_files set status='stored' where id=f.id;
 update public.recollection_audio set duration_ms=coalesce(p_duration_ms,a.duration_ms),updated_at=now() where id=a.id;
 if a.standalone then update public.archive_items set ingestion_status='ready',updated_at=now() where id=f.item_id;end if;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(a.archive_id,f.item_id,auth.uid(),'audio_original_preserved',jsonb_build_object('recording_id',a.id,'file_id',f.id,'sha256',f.sha256),'family_reported');
 insert into public.activity_log(archive_id,actor_id,event_type,item_id,summary) values(a.archive_id,auth.uid(),'audio_preserved',f.item_id,'An original voice recording was preserved unchanged.');
 return f.item_id;end
$$;
create function public.archive_audio_recording(p_recording_id uuid,p_archived boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare a public.recollection_audio; f public.archive_item_files; begin
 select * into a from public.recollection_audio where id=p_recording_id for update;
 if a.id is null or not archive_private.can_access(a.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into f from public.archive_item_files where id=a.original_file_id;
 update public.recollection_audio set archived_at=case when p_archived then now() else null end,last_edited_by=auth.uid(),updated_at=now() where id=a.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(a.archive_id,f.item_id,auth.uid(),'audio_archive_state',jsonb_build_object('recording_id',a.id,'archived',p_archived),'family_reported');
 end
$$;
-- Archive credits expose display names only; profiles/email RLS remains unchanged.
create function public.audio_attribution(p_archive_id uuid) returns table(recording_id uuid,display_name text) language sql stable security definer set search_path=public,pg_temp as $$
 select a.id,p.display_name from public.recollection_audio a join public.profiles p on p.id=a.contributed_by
 where a.archive_id=p_archive_id and archive_private.audio_readable(a.id)
$$;
revoke all on function public.audio_attribution(uuid) from public,anon;
grant execute on function public.audio_attribution(uuid) to authenticated;

revoke all on function public.begin_audio_recording(uuid,uuid,uuid,jsonb,jsonb,uuid[],uuid[]),public.edit_audio_recording(uuid,jsonb,uuid[],uuid[]),public.complete_audio_recording(uuid,integer),public.archive_audio_recording(uuid,boolean) from public,anon;
grant execute on function public.begin_audio_recording(uuid,uuid,uuid,jsonb,jsonb,uuid[],uuid[]),public.edit_audio_recording(uuid,jsonb,uuid[],uuid[]),public.complete_audio_recording(uuid,integer),public.archive_audio_recording(uuid,boolean) to authenticated;
commit;
