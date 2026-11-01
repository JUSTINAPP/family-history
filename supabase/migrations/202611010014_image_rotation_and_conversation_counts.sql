begin;
-- Presentation only: no original bytes, checksums, EXIF or derivative objects are rewritten.
alter table public.archive_item_files add column presentation_rotation integer not null default 0
 check(presentation_rotation in (0,90,180,270));
create or replace view public.current_image_sets with(security_invoker=true) as
 select g.*,f.presentation_rotation from (
 select distinct on (original_file_id) * from public.image_sets where status='stored'
 order by original_file_id,created_at desc,id desc
 ) g join public.archive_item_files f on f.id=g.original_file_id;
create view public.item_conversation_counts with(security_invoker=true) as
 select archive_id,item_id,count(*)::integer as comment_count from public.comments
 where archived_at is null group by archive_id,item_id;
revoke all on public.item_conversation_counts from public,anon,authenticated;
grant select on public.item_conversation_counts to authenticated;
create function public.rotate_item_image(p_source_id uuid,p_turn integer,p_expected integer)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare f public.archive_item_files;angle integer;begin
 select * into f from public.archive_item_files where id=p_source_id;
 if f.id is null or not archive_private.can_edit_item_places(f.archive_id,f.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into f from public.archive_item_files where id=p_source_id for update;
 if exists(select 1 from public.archive_items where id=f.item_id and archived_at is not null) then raise exception 'item_archived';end if;
 if f.purpose<>'original' or f.status<>'stored' then raise exception 'invalid_image';end if;
 if p_turn is null or p_turn not in (-90,90) then raise exception 'invalid_rotation';end if;
 if p_expected is distinct from f.presentation_rotation then raise exception 'image_changed_reload' using errcode='40001';end if;
 angle:=(f.presentation_rotation+p_turn+360)%360;
 update public.archive_item_files set presentation_rotation=angle where id=f.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(f.archive_id,f.item_id,auth.uid(),'image_rotation',jsonb_build_object('original_file_id',f.id,'before',f.presentation_rotation,'after',angle,'original_sha256',f.sha256),'family_reported');
 return angle;
end $$;
revoke all on function public.rotate_item_image(uuid,integer,integer) from public,anon;
grant execute on function public.rotate_item_image(uuid,integer,integer) to authenticated;
commit;
