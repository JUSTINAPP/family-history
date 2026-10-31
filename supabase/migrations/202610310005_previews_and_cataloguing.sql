begin;
-- Additive follow-up for an existing archive. No source bytes or historical rows are removed.
alter table public.archive_items add column last_edited_by uuid references public.profiles(id);
alter table public.archive_items add column catalogued_at timestamptz;
alter table public.archive_item_files drop constraint archive_item_files_item_id_page_order_key;
alter table public.archive_item_files add constraint item_file_purpose_order unique(item_id,page_order,purpose);
create unique index one_display_per_source on public.archive_item_files(parent_original_id,purpose) where purpose='display';

create function archive_private.can_prepare_preview(f uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.archive_item_files s join public.archive_items i on i.id=s.item_id and i.archive_id=s.archive_id
 where s.id=f and s.purpose='original' and s.status='stored' and i.ingestion_status='ready'
 and (archive_private.can_access(s.archive_id,'editor') or (archive_private.can_access(s.archive_id,'contributor') and i.contributed_by=auth.uid())))
$$;
revoke all on function archive_private.can_prepare_preview(uuid) from public,anon;
grant execute on function archive_private.can_prepare_preview(uuid) to authenticated;

-- Editors can recover a reserved display uploaded by its contributor; this does not widen source reads.
create or replace function archive_private.can_read_object(b text,p text) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.archive_item_files f where f.bucket_id=b and f.storage_path=p
 and archive_private.item_readable(f.archive_id,f.item_id)
 and (f.status='stored' or f.uploaded_by=auth.uid() or (f.purpose='display' and archive_private.can_prepare_preview(f.parent_original_id))))
$$;

create function public.reserve_display(p_source_id uuid,p_sha256 text,p_size bigint,p_width integer,p_height integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare s public.archive_item_files; d public.archive_item_files; fid uuid:=gen_random_uuid(); begin
 if not archive_private.can_prepare_preview(p_source_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into s from public.archive_item_files where id=p_source_id for update;
 select * into d from public.archive_item_files where parent_original_id=s.id and purpose='display';
 if found then
 if d.sha256<>p_sha256 or d.byte_size<>p_size then raise exception 'preview_conflict';end if;
 return d.id;
 end if;
 if p_size not between 1 and 10485760 or p_width not between 1 and 2400 or p_height not between 1 and 2400 then raise exception 'invalid_preview';end if;
 insert into public.archive_item_files(id,archive_id,item_id,purpose,parent_original_id,bucket_id,storage_path,original_filename,mime_type,byte_size,sha256,width,height,page_order,page_role,uploaded_by)
 values(fid,s.archive_id,s.item_id,'display',s.id,'archive-derived',s.archive_id::text||'/'||s.item_id::text||'/'||fid::text,'display.jpg','image/jpeg',p_size,p_sha256,p_width,p_height,s.page_order,'display',auth.uid());
 return fid;end
$$;
create policy archive_display_insert on storage.objects for insert to authenticated with check(
 bucket_id='archive-derived' and exists(select 1 from public.archive_item_files f where f.bucket_id=storage.objects.bucket_id and f.storage_path=storage.objects.name
 and f.purpose='display' and f.status='reserved' and archive_private.can_prepare_preview(f.parent_original_id)));
-- Still no UPDATE/DELETE policy, including for originals.
create function public.complete_display(p_file_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare f public.archive_item_files; begin
 select * into f from public.archive_item_files where id=p_file_id and purpose='display' for update;
 if f.id is null or not archive_private.can_prepare_preview(f.parent_original_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if f.status='stored' then return;end if;
 if not exists(select 1 from storage.objects o where o.bucket_id=f.bucket_id and o.name=f.storage_path and (o.metadata->>'size')::bigint=f.byte_size and o.metadata->>'mimetype'=f.mime_type) then raise exception 'upload_incomplete';end if;
 update public.archive_item_files set status='stored' where id=f.id;
 update public.processing_jobs set status='complete',updated_at=now() where item_id=f.item_id and stage='create_display_derivatives'
 and not exists(select 1 from public.archive_item_files s where s.item_id=f.item_id and s.purpose='original' and not exists(select 1 from public.archive_item_files d where d.parent_original_id=s.id and d.purpose='display' and d.status='stored'));
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(f.archive_id,f.item_id,auth.uid(),'display_derivative',jsonb_build_object('file_id',f.id,'original_file_id',f.parent_original_id,'sha256',f.sha256),'family_reported');
 end
$$;

create function public.catalogue_item(p_archive_id uuid,p_item_id uuid,p_title text,p_kind text,p_notes text,p_people text,p_date text,p_precision text,p_place text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare i public.archive_items; begin
 select * into i from public.archive_items where archive_id=p_archive_id and id=p_item_id for update;
 if i.id is null or i.ingestion_status<>'ready' or not (archive_private.can_access(p_archive_id,'editor') or (archive_private.can_access(p_archive_id,'contributor') and i.contributed_by=auth.uid())) then raise exception 'permission_denied' using errcode='42501';end if;
 if length(trim(p_title)) not between 1 and 300 or length(p_notes)>20000 or length(p_people)>1000 or length(p_date)>300 or length(p_place)>1000 then raise exception 'invalid_metadata';end if;
 -- A contributor cannot silently change metadata previously verified by an editor.
 if i.evidence_status='verified' and not archive_private.can_access(p_archive_id,'editor') then raise exception 'editor_required' using errcode='42501';end if;
 update public.archive_items set title=trim(p_title),kind=p_kind,notes=p_notes,people_text=p_people,reported_date=p_date,date_precision=p_precision,reported_place=p_place,
 evidence_status='family_reported',last_edited_by=auth.uid(),catalogued_at=now(),updated_at=now() where id=i.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(i.archive_id,i.id,auth.uid(),'catalogue_edit',jsonb_build_object('before',jsonb_build_object('title',i.title,'kind',i.kind,'notes',i.notes,'people',i.people_text,'date',i.reported_date,'precision',i.date_precision,'place',i.reported_place),'after',jsonb_build_object('title',trim(p_title),'kind',p_kind,'notes',p_notes,'people',p_people,'date',p_date,'precision',p_precision,'place',p_place)),'family_reported');
 insert into public.activity_log(archive_id,actor_id,event_type,item_id,summary) values(i.archive_id,auth.uid(),'metadata_updated',i.id,'Catalogue context updated; originals and attributed recollections retained.');
 end
$$;
revoke all on function public.reserve_display(uuid,text,bigint,integer,integer),public.complete_display(uuid),public.catalogue_item(uuid,uuid,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.reserve_display(uuid,text,bigint,integer,integer),public.complete_display(uuid),public.catalogue_item(uuid,uuid,text,text,text,text,text,text,text) to authenticated;
commit;
