begin;
-- Explicit catalogue classification only; no source, derivative or association is moved/replaced.
create function public.set_item_kind(p_archive_id uuid,p_item_id uuid,p_kind text,p_expected text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;begin
 if not archive_private.can_edit_item_places(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into i from public.archive_items where archive_id=p_archive_id and id=p_item_id for update;
 if i.id is null or i.archived_at is not null or i.grouping_kind='split_context' then raise exception 'item_state_conflict';end if;
 if i.kind='Audio' or p_kind is null or p_kind not in ('Photograph','Letter','Document','Object','Postcard','Certificate','Artwork','Other') then raise exception 'invalid_item_kind';end if;
 if p_expected is distinct from i.kind then raise exception 'item_type_changed_reload' using errcode='40001';end if;
 if p_kind=i.kind then return;end if;
 if exists(select 1 from public.document_runs where item_id=i.id and status='processing' and updated_at>now()-interval '3 minutes') then raise exception 'document_busy';end if;
 update public.archive_items set kind=p_kind,
 grouping_kind=case when grouping_kind='separate_photograph' and p_kind<>'Photograph' then 'single_object' else grouping_kind end,
 last_edited_by=auth.uid(),updated_at=now() where id=i.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(i.archive_id,i.id,auth.uid(),'item_kind_changed',jsonb_build_object('before',i.kind,'after',p_kind),'family_reported');
end $$;
revoke all on function public.set_item_kind(uuid,uuid,text,text) from public,anon;
grant execute on function public.set_item_kind(uuid,uuid,text,text) to authenticated;
commit;
