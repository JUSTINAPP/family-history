-- Read-only; works before and after migration 009. No preview generation or master download.
select s.archive_id,s.item_id,s.id as original_id,s.original_filename,
 s.byte_size as master_bytes,s.sha256 as master_sha256,
 d.id as derived_id,d.purpose,d.status,d.mime_type,d.width,d.height,d.byte_size as derived_bytes,d.created_at,
 b.public as derived_bucket_public
from public.archive_item_files s
left join public.archive_item_files d on d.parent_original_id=s.id and d.purpose in ('display','thumbnail')
left join storage.buckets b on b.id=d.bucket_id
where s.purpose='original' and s.original_filename in ('IMG_6390.HEIC','IMG_6391.HEIC')
order by s.id,d.created_at,d.purpose,d.width;

-- After 009, inspect public.current_image_sets for the currently selected variant IDs.
