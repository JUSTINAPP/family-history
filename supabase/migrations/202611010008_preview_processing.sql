begin;
-- Per-original diagnostics and short leases; originals, existing derivatives and policies are untouched.
create table public.preview_attempts (
 original_file_id uuid primary key,
 archive_id uuid not null,
 item_id uuid not null,
 attempt_id uuid not null,
 status text not null check(status in ('processing','failed','complete')),
 stage text not null check(stage in ('download','integrity','decode','reserve','upload','complete')),
 attempts integer not null default 1,
 error_code text,
 started_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(archive_id,original_file_id) references public.archive_item_files(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id)
);
alter table public.preview_attempts enable row level security;
alter table public.preview_attempts force row level security;
revoke all on public.preview_attempts from public,anon,authenticated;
grant select on public.preview_attempts to authenticated;
create policy preview_attempt_read on public.preview_attempts for select to authenticated
 using(archive_private.item_readable(archive_id,item_id));

create function public.begin_preview_attempt(p_source_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.archive_item_files; a public.preview_attempts; token uuid:=gen_random_uuid(); begin
 if not archive_private.can_prepare_preview(p_source_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into s from public.archive_item_files where id=p_source_id for update;
 select * into a from public.preview_attempts where original_file_id=s.id;
 if a.status='processing' and a.started_at>now()-interval '75 seconds' then
  raise exception 'preview_busy' using errcode='55P03';
 end if;
 insert into public.preview_attempts(original_file_id,archive_id,item_id,attempt_id,status,stage)
 values(s.id,s.archive_id,s.item_id,token,'processing','download')
 on conflict(original_file_id) do update set attempt_id=excluded.attempt_id,status='processing',stage='download',
 attempts=preview_attempts.attempts+1,error_code=null,started_at=now(),updated_at=now();
 insert into public.processing_jobs(archive_id,item_id,stage,status,attempts)
 values(s.archive_id,s.item_id,'create_display_derivatives','processing',1)
 on conflict(item_id,stage) do update set status='processing',attempts=processing_jobs.attempts+1,error_code=null,updated_at=now();
 return token;
end $$;

create function public.record_preview_attempt(p_source_id uuid,p_attempt_id uuid,p_stage text,p_error_code text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.preview_attempts; begin
 if not archive_private.can_prepare_preview(p_source_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into a from public.preview_attempts where original_file_id=p_source_id for update;
 if a.attempt_id is distinct from p_attempt_id then raise exception 'stale_preview_attempt' using errcode='40001';end if;
 if a.status<>'processing' then raise exception 'preview_attempt_finished';end if;
 if p_stage not in ('download','integrity','decode','reserve','upload','complete') or p_stage is null
 or (p_error_code is not null and p_error_code !~ '^[a-z][a-z0-9_]{0,79}$') then raise exception 'invalid_preview_state';end if;
 if p_stage='complete' and p_error_code is null and not exists(
 select 1 from public.archive_item_files where parent_original_id=p_source_id and purpose='display' and status='stored'
 ) then raise exception 'preview_receipt_missing';end if;
 update public.preview_attempts set stage=p_stage,error_code=p_error_code,
 status=case when p_error_code is not null then 'failed' when p_stage='complete' then 'complete' else 'processing' end,updated_at=now()
 where original_file_id=p_source_id;
 update public.processing_jobs set updated_at=now(),
 status=case
 when not exists(select 1 from public.archive_item_files s where s.item_id=a.item_id and s.purpose='original' and not exists(
 select 1 from public.archive_item_files d where d.parent_original_id=s.id and d.purpose='display' and d.status='stored')) then 'complete'
 when exists(select 1 from public.preview_attempts where item_id=a.item_id and status='failed') then 'failed'
 when exists(select 1 from public.preview_attempts where item_id=a.item_id and status='processing') then 'processing'
 else 'queued' end,
 error_code=(select error_code from public.preview_attempts where item_id=a.item_id and status='failed' order by updated_at desc limit 1)
 where item_id=a.item_id and stage='create_display_derivatives';
end $$;
revoke all on function public.begin_preview_attempt(uuid),public.record_preview_attempt(uuid,uuid,text,text) from public,anon;
grant execute on function public.begin_preview_attempt(uuid),public.record_preview_attempt(uuid,uuid,text,text) to authenticated;

-- A future converter may produce different bytes after an interrupted reservation.
-- Reuse matching receipts; only an empty, unuploaded derived reservation can change.
create or replace function public.reserve_display(p_source_id uuid,p_sha256 text,p_size bigint,p_width integer,p_height integer)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.archive_item_files; d public.archive_item_files; fid uuid:=gen_random_uuid(); begin
 if not archive_private.can_prepare_preview(p_source_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_size is null or p_width is null or p_height is null or p_sha256 is null
 or p_size not between 1 and 10485760 or p_width not between 1 and 2400 or p_height not between 1 and 2400
 or p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'invalid_preview';end if;
 select * into s from public.archive_item_files where id=p_source_id for update;
 select * into d from public.archive_item_files where parent_original_id=s.id and purpose='display';
 if found then
  if d.sha256<>p_sha256 or d.byte_size<>p_size then
   if d.status<>'reserved' or exists(select 1 from storage.objects where bucket_id=d.bucket_id and name=d.storage_path) then raise exception 'preview_conflict';end if;
   update public.archive_item_files set sha256=p_sha256,byte_size=p_size,width=p_width,height=p_height where id=d.id;
  end if;
  return d.id;
 end if;
 insert into public.archive_item_files(id,archive_id,item_id,purpose,parent_original_id,bucket_id,storage_path,original_filename,mime_type,byte_size,sha256,width,height,page_order,page_role,uploaded_by)
 values(fid,s.archive_id,s.item_id,'display',s.id,'archive-derived',s.archive_id::text||'/'||s.item_id::text||'/'||fid::text,'display.jpg','image/jpeg',p_size,p_sha256,p_width,p_height,s.page_order,'display',auth.uid());
 return fid;
end $$;
commit;
