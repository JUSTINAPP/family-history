begin;
-- Independent of audio migration 006. Requires only the installed foundation/preview migrations 001–005.
-- Existing items, source rows, objects, checksums and recollections are unchanged.
create table public.import_batches (
 id uuid primary key default gen_random_uuid(),archive_id uuid not null references public.archives(id),
 context text not null default '' check(length(context)<=20000),expected_count integer not null check(expected_count between 1 and 500),
 created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(archive_id,id)
);
create table public.import_batch_items (
 archive_id uuid not null,batch_id uuid not null,item_id uuid not null unique,created_at timestamptz not null default now(),
 primary key(batch_id,item_id),foreign key(archive_id,batch_id) references public.import_batches(archive_id,id),foreign key(archive_id,item_id) references public.archive_items(archive_id,id)
);
create index import_batches_recent on public.import_batches(archive_id,created_at desc);
alter table public.import_batches enable row level security;
alter table public.import_batches force row level security;
alter table public.import_batch_items enable row level security;
alter table public.import_batch_items force row level security;
revoke all on public.import_batches,public.import_batch_items from public,anon,authenticated;
grant select on public.import_batches,public.import_batch_items to authenticated;
create policy import_batches_read on public.import_batches for select to authenticated using(archive_private.can_access(archive_id));
create policy import_batch_items_read on public.import_batch_items for select to authenticated using(archive_private.item_readable(archive_id,item_id));

create function public.create_import_batch(p_archive_id uuid,p_batch_id uuid,p_context text,p_expected_count integer) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare b public.import_batches;begin
 if not archive_private.can_access(p_archive_id,'contributor') then raise exception 'permission_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_batch_id::text,0));
 select * into b from public.import_batches where id=p_batch_id;
 if found then
 if b.archive_id<>p_archive_id or b.created_by<>auth.uid() or b.context<>p_context or b.expected_count<>p_expected_count then raise exception 'batch_conflict';end if;
 return b.id;end if;
 insert into public.import_batches(id,archive_id,context,expected_count,created_by) values(p_batch_id,p_archive_id,p_context,p_expected_count,auth.uid());return p_batch_id;end
$$;
create function public.begin_batch_photograph(p_archive_id uuid,p_batch_id uuid,p_capture_id uuid,p_file jsonb) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare b public.import_batches;item uuid;begin
 if not archive_private.can_access(p_archive_id,'contributor') then raise exception 'permission_denied' using errcode='42501';end if;
 select * into b from public.import_batches where id=p_batch_id and archive_id=p_archive_id for update;
 -- Only the original importing account resumes its source reservations, including when that account is an Editor.
 if b.id is null or b.created_by<>auth.uid() then raise exception 'permission_denied' using errcode='42501';end if;
 select i.id into item from public.archive_items i join public.import_batch_items l on l.item_id=i.id
 where l.batch_id=b.id and i.contributed_by=auth.uid() and i.client_capture_id=p_capture_id;
 if item is not null then return item;end if;
 if (select count(*) from public.import_batch_items where batch_id=b.id)>=b.expected_count then raise exception 'batch_full';end if;
 item:=public.begin_ingestion(p_archive_id,p_capture_id,'Photograph, still to be catalogued','Photograph','','{"precision":"unknown"}',jsonb_build_array(p_file));
 if (select count(*) from public.archive_item_files where item_id=item and purpose='original')<>1 then raise exception 'one_source_per_bulk_item';end if;
 insert into public.import_batch_items(archive_id,batch_id,item_id) values(p_archive_id,b.id,item);
 return item;end
$$;
revoke all on function public.create_import_batch(uuid,uuid,text,integer),public.begin_batch_photograph(uuid,uuid,uuid,jsonb) from public,anon;
grant execute on function public.create_import_batch(uuid,uuid,text,integer),public.begin_batch_photograph(uuid,uuid,uuid,jsonb) to authenticated;
create unique index catalogue_context_operation on public.provenance(actor_id,(value->>'catalogue_write_id')) where field_path='catalogue_context';
create function public.save_catalogue_context(p_archive_id uuid,p_item_id uuid,p_details jsonb,p_recollection text,p_write_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 if not archive_private.can_access(p_archive_id,'contributor') or not archive_private.item_readable(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_write_id is null or length(coalesce(p_recollection,''))>20000 then raise exception 'invalid_context';end if;
 perform 1 from public.archive_items where id=p_item_id and archive_id=p_archive_id for update;
 if not found then raise exception 'item_not_found';end if;
 if exists(select 1 from public.provenance where actor_id=auth.uid() and field_path='catalogue_context' and value->>'catalogue_write_id'=p_write_id::text) then return;end if;
 perform public.catalogue_item(p_archive_id,p_item_id,p_details->>'title',p_details->>'kind',coalesce(p_details->>'notes',''),coalesce(p_details->>'people',''),coalesce(p_details->>'date',''),coalesce(p_details->>'precision','unknown'),coalesce(p_details->>'place',''));
 if length(trim(coalesce(p_recollection,'')))>0 then perform public.add_recollection(p_archive_id,p_item_id,p_recollection);end if;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(p_archive_id,p_item_id,auth.uid(),'catalogue_context',jsonb_build_object('catalogue_write_id',p_write_id),'family_reported');
 end
$$;
revoke all on function public.save_catalogue_context(uuid,uuid,jsonb,text,uuid) from public,anon;
grant execute on function public.save_catalogue_context(uuid,uuid,jsonb,text,uuid) to authenticated;
-- Scoped galleries remain complete even when an archive grows beyond the default API row limit.
create function public.list_import_photographs(p_archive_id uuid,p_batch_id uuid) returns setof public.archive_items language sql stable security invoker set search_path=public,pg_temp as $$
 select i.* from public.archive_items i join public.import_batch_items l on l.item_id=i.id and l.archive_id=i.archive_id
 where l.archive_id=p_archive_id and l.batch_id=p_batch_id and i.ingestion_status='ready' order by i.created_at,i.id
$$;
create function public.list_import_originals(p_archive_id uuid,p_batch_id uuid) returns setof public.archive_item_files language sql stable security invoker set search_path=public,pg_temp as $$
 select f.* from public.archive_item_files f join public.import_batch_items l on l.item_id=f.item_id and l.archive_id=f.archive_id
 where l.archive_id=p_archive_id and l.batch_id=p_batch_id and f.purpose='original' and f.status='stored' order by f.created_at,f.id
$$;
revoke all on function public.list_import_photographs(uuid,uuid),public.list_import_originals(uuid,uuid) from public,anon;
grant execute on function public.list_import_photographs(uuid,uuid),public.list_import_originals(uuid,uuid) to authenticated;
create function public.next_uncatalogued_photograph(p_archive_id uuid,p_item_id uuid,p_batch_id uuid default null) returns uuid language sql stable security invoker set search_path=public,pg_temp as $$
 select i.id from public.archive_items i where i.archive_id=p_archive_id and i.id<>p_item_id and i.kind='Photograph' and i.ingestion_status='ready' and i.catalogued_at is null
 and archive_private.can_access(p_archive_id,'contributor')
 and (archive_private.can_access(p_archive_id,'editor') or (i.contributed_by=auth.uid() and i.evidence_status<>'verified'))
 and (p_batch_id is null or exists(select 1 from public.import_batch_items l where l.item_id=i.id and l.archive_id=i.archive_id and l.batch_id=p_batch_id))
 order by i.created_at,i.id limit 1
$$;
revoke all on function public.next_uncatalogued_photograph(uuid,uuid,uuid) from public,anon;
grant execute on function public.next_uncatalogued_photograph(uuid,uuid,uuid) to authenticated;
commit;
