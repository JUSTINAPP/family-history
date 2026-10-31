-- Read-only, after migration 008. Does not generate previews or change any data.
-- Filter by the existing item's UUID if desired. A SQL Editor admin sees more than an RLS session.
select s.archive_id,s.item_id,s.id as original_id,s.original_filename,s.byte_size,s.sha256,
 s.bucket_id as original_bucket,s.status as original_status,
 d.id as display_id,d.bucket_id as display_bucket,d.status as display_status,d.mime_type as display_type,
 d.width,d.height,d.byte_size as display_bytes,
 a.status as attempt_status,a.stage,a.attempts,a.error_code,a.started_at,a.updated_at,
 j.status as job_status,j.error_code as job_error,
 b.public as derived_bucket_public
from public.archive_item_files s
left join public.archive_item_files d on d.parent_original_id=s.id and d.purpose='display'
left join public.preview_attempts a on a.original_file_id=s.id
left join public.processing_jobs j on j.item_id=s.item_id and j.stage='create_display_derivatives'
left join storage.buckets b on b.id='archive-derived'
where s.purpose='original' and s.mime_type in ('image/heic','image/heif')
order by s.item_id,s.page_order;
