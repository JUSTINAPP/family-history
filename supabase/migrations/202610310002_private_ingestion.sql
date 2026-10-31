begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('archive-originals','archive-originals',false,31457280,array['image/jpeg','image/png','image/webp','image/heic','image/heif']),
 ('archive-derived','archive-derived',false,31457280,array['image/jpeg','image/png','image/webp','image/avif']),
 ('archive-audio','archive-audio',false,31457280,array['audio/webm','audio/ogg','audio/mp4','audio/wav'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function archive_private.can_upload(b text,p text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.archive_item_files f join public.archive_items i on i.id=f.item_id and i.archive_id=f.archive_id
 where f.bucket_id=b and f.storage_path=p and f.status='reserved' and f.purpose in ('original','audio_original')
 and f.uploaded_by=auth.uid() and i.contributed_by=auth.uid() and i.ingestion_status='uploading'
 and archive_private.can_access(f.archive_id,'contributor'))
$$;
create function archive_private.can_read_object(b text,p text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.archive_item_files f where f.bucket_id=b and f.storage_path=p
 and archive_private.item_readable(f.archive_id,f.item_id)
 and (f.status='stored' or f.uploaded_by=auth.uid()))
$$;
revoke all on function archive_private.can_upload(text,text),archive_private.can_read_object(text,text) from public,anon;
grant execute on function archive_private.can_upload(text,text),archive_private.can_read_object(text,text) to authenticated;
create policy archive_original_insert on storage.objects for insert to authenticated with check(archive_private.can_upload(bucket_id,name));
create policy archive_private_read on storage.objects for select to authenticated using(archive_private.can_read_object(bucket_id,name));
-- Deliberately NO UPDATE/DELETE policies: browser/users cannot upsert, rename or remove originals.
-- No derived writes are enabled until a separately reviewed processing worker is connected.

create function public.begin_ingestion(p_archive_id uuid,p_capture_id uuid,p_title text,p_kind text,p_context text,p_quick jsonb,p_files jsonb)
 returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare item uuid; f jsonb; fid uuid; n integer:=0; total_bytes bigint:=0; begin
 if not archive_private.can_access(p_archive_id,'contributor') then raise exception 'permission_denied' using errcode='42501';end if;
 -- Serialise retries from the same archive/user/capture without a global lock.
 perform pg_advisory_xact_lock(hashtextextended(p_archive_id::text||auth.uid()::text||p_capture_id::text,0));
 select id into item from public.archive_items where archive_id=p_archive_id and contributed_by=auth.uid() and client_capture_id=p_capture_id;
 if item is not null then return item;end if;
 if jsonb_typeof(p_files)<>'array' or jsonb_array_length(p_files) not between 1 and 20 then raise exception 'invalid_file_count';end if;
 insert into public.archive_items(archive_id,client_capture_id,title,kind,notes,reported_date,date_precision,reported_place,people_text,contributed_by)
 values(p_archive_id,p_capture_id,p_title,p_kind,'',left(coalesce(p_quick->>'When',''),300),coalesce(p_quick->>'precision','unknown'),
 left(coalesce(p_quick->>'Where',''),300),left(coalesce(p_quick->>'People',p_quick->>'Written by',''),300),auth.uid()) returning id into item;
 for f in select value from jsonb_array_elements(p_files) loop
 if f->>'mimeType' not in ('image/jpeg','image/png','image/webp','image/heic','image/heif') then raise exception 'invalid_mime_type';end if;
 if length(f->>'name') not between 1 and 255 or (f->>'size')::bigint not between 1 and 31457280 then raise exception 'invalid_file';end if;
 total_bytes:=total_bytes+(f->>'size')::bigint;if total_bytes>83886080 then raise exception 'batch_too_large';end if;
 fid:=gen_random_uuid();
 insert into public.archive_item_files(id,archive_id,item_id,purpose,bucket_id,storage_path,original_filename,mime_type,byte_size,sha256,page_order,page_role,uploaded_by)
 values(fid,p_archive_id,item,'original','archive-originals',p_archive_id::text||'/'||item::text||'/'||fid::text,
 f->>'name',f->>'mimeType',(f->>'size')::bigint,f->>'sha256',n,left(coalesce(f->>'role','image'),40),auth.uid());n:=n+1;
 end loop;
 if length(trim(coalesce(p_context,'')))>0 then perform public.add_recollection(p_archive_id,item,p_context);end if;
 return item;end
$$;
create function public.complete_ingestion(p_archive_id uuid,p_item_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare item public.archive_items; f record; begin
 select * into item from public.archive_items where archive_id=p_archive_id and id=p_item_id for update;
 if item.id is null or item.contributed_by<>auth.uid() or not archive_private.can_access(p_archive_id,'contributor') then raise exception 'permission_denied' using errcode='42501';end if;
 if item.ingestion_status='ready' then return;end if;
 if not exists(select 1 from public.archive_item_files where item_id=p_item_id and archive_id=p_archive_id) then raise exception 'files_required';end if;
 for f in select * from public.archive_item_files where item_id=p_item_id and archive_id=p_archive_id loop
 if not exists(select 1 from storage.objects o where o.bucket_id=f.bucket_id and o.name=f.storage_path
 and coalesce((o.metadata->>'size')::bigint,-1)=f.byte_size and o.metadata->>'mimetype'=f.mime_type) then raise exception 'upload_incomplete';end if;
 end loop;
 update public.archive_item_files set status='stored' where archive_id=p_archive_id and item_id=p_item_id and status='reserved';
 update public.archive_items set ingestion_status='ready',updated_at=now() where archive_id=p_archive_id and id=p_item_id;
 insert into public.processing_jobs(archive_id,item_id,stage) values(p_archive_id,p_item_id,'create_display_derivatives') on conflict(item_id,stage) do nothing;
 insert into public.activity_log(archive_id,actor_id,event_type,item_id,summary) values(p_archive_id,auth.uid(),'originals_preserved',p_item_id,'Original files preserved. Display processing is queued; no AI has run.');
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(p_archive_id,p_item_id,auth.uid(),'source_receipt',jsonb_build_object('status','stored'),'family_reported');
 end
$$;
revoke all on function public.begin_ingestion(uuid,uuid,text,text,text,jsonb,jsonb),public.complete_ingestion(uuid,uuid) from public,anon;
grant execute on function public.begin_ingestion(uuid,uuid,text,text,text,jsonb,jsonb),public.complete_ingestion(uuid,uuid) to authenticated;
-- FORCE RLS protects future table owners lacking BYPASSRLS as well; helpers are owned by the trusted migration role.
do $$ declare t text; begin
 foreach t in array array['profiles','archives','archive_memberships','invitations','people','archive_items','archive_item_files','recollections','recollection_audio','transcriptions','metadata_suggestions','comments','identifications','processing_jobs','activity_log','provenance'] loop
 execute format('alter table public.%I force row level security',t);end loop;end $$;
alter table archive_private.invitation_tokens enable row level security;
commit;
