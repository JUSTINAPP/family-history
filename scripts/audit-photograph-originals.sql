-- READ ONLY. Run in Supabase SQL Editor to inspect the reported capture.
-- Do not run ingestion/finalisation/preview RPCs as part of this audit.
begin read only;
set local statement_timeout='15s';
with recent as (
 select i.*,a.name archive_name from public.archive_items i join public.archives a on a.id=i.archive_id
 where a.name='The Allen & Cork Archive' and i.kind<>'Audio' order by i.created_at desc limit 20
)
select i.archive_name,i.id item_id,i.title,i.created_at,i.ingestion_status,
 f.id file_id,f.purpose,f.page_order,f.original_filename,f.status file_status,
 f.bucket_id,f.storage_path,f.byte_size,f.sha256,f.mime_type,
 (o.id is not null) object_exists,o.metadata->>'size' stored_size,
 case when f.id is null then 'no file reservation'
 when o.id is null then 'reserved but no object at this path'
 when coalesce(o.metadata->>'size','')<>f.byte_size::text then 'object exists but size receipt differs'
 when f.status<>'stored' or i.ingestion_status<>'ready' then 'object exists, receipt/item unfinished'
 else 'original exists and item is ready' end source_state,
 exists(select 1 from public.archive_item_files d join storage.objects s on s.bucket_id=d.bucket_id and s.name=d.storage_path
 where d.parent_original_id=f.id and d.purpose='display' and d.status='stored') display_exists
from recent i left join public.archive_item_files f on f.item_id=i.id and f.archive_id=i.archive_id and f.purpose='original'
left join storage.objects o on o.bucket_id=f.bucket_id and o.name=f.storage_path
order by i.created_at desc,i.id,f.page_order;

-- Possible unreferenced source objects, not matched by a file reservation.
select o.bucket_id,o.name storage_path,o.created_at from storage.objects o
where o.bucket_id='archive-originals'
and exists(select 1 from public.archives a where a.name='The Allen & Cork Archive' and split_part(o.name,'/',1)=a.id::text)
and not exists(select 1 from public.archive_item_files f where f.bucket_id=o.bucket_id and f.storage_path=o.name)
order by o.created_at desc limit 20;

-- Independent read-only check for migration 006. Its absence does not affect this audit.
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='recollection_audio' and column_name='client_capture_id') audio_006_schema_present;
rollback;
