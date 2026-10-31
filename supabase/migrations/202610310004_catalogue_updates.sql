begin;
-- Canonical metadata is editor-only; contributor recollections remain immutable, attributed sources.
create function public.update_item_metadata(p_archive_id uuid,p_item_id uuid,p_title text,p_date text,p_place text,p_people text,p_status public.evidence_status default 'family_reported',p_source_file_id uuid default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 if not archive_private.can_access(p_archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 if p_status='ai_suggested' then raise exception 'suggestions_are_not_facts';end if;
 if p_status='verified' and not exists(select 1 from public.archive_item_files where archive_id=p_archive_id and item_id=p_item_id and id=p_source_file_id and status='stored') then raise exception 'source_evidence_required';end if;
 update public.archive_items set title=p_title,reported_date=left(p_date,300),reported_place=left(p_place,300),people_text=left(p_people,300),evidence_status=p_status,updated_at=now() where archive_id=p_archive_id and id=p_item_id;
 if not found then raise exception 'item_not_found';end if;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(p_archive_id,p_item_id,auth.uid(),'catalogue_metadata',jsonb_build_object('title',p_title,'date',p_date,'place',p_place,'people',p_people,'source_file_id',p_source_file_id),p_status);
 insert into public.activity_log(archive_id,actor_id,event_type,item_id,summary) values(p_archive_id,auth.uid(),'metadata_updated',p_item_id,'An editor updated catalogue metadata; source material and recollections retained.');
 end
$$;
revoke all on function public.update_item_metadata(uuid,uuid,text,text,text,text,public.evidence_status,uuid) from public,anon;
grant execute on function public.update_item_metadata(uuid,uuid,text,text,text,text,public.evidence_status,uuid) to authenticated;
commit;
