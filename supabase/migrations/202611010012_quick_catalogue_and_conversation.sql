begin;
-- Reuse comments and historical date text; no automatic interpretation or historical backfill.
alter table public.archive_items drop constraint archive_items_date_precision_check;
alter table public.archive_items add constraint archive_items_date_precision_check
 check(date_precision in ('exact','month','year','approximate','decade','unknown'));
alter table public.comments add column parent_id uuid;
alter table public.comments add column edited_at timestamptz;
alter table public.comments add column archived_at timestamptz;
alter table public.comments add column archived_by uuid references public.profiles(id);
alter table public.comments add column revision integer not null default 1 check(revision>0);
alter table public.comments add column client_write_id uuid;
alter table public.comments add constraint comment_item_identity unique(archive_id,item_id,id);
alter table public.comments add constraint comment_reply_same_item foreign key(archive_id,item_id,parent_id)
 references public.comments(archive_id,item_id,id) deferrable initially deferred;
create unique index comment_write_once on public.comments(author_id,client_write_id) where client_write_id is not null;
create index comments_item_thread on public.comments(archive_id,item_id,created_at,id);
drop policy content_read on public.comments;
create policy content_read on public.comments for select to authenticated using(
 archive_private.item_readable(archive_id,item_id) and
 (archived_at is null or author_id=auth.uid() or archive_private.can_access(archive_id,'editor')));
-- Keep edit/moderation audit text available only to its author/actor and Editors.
drop policy content_read on public.provenance;
create policy content_read on public.provenance for select to authenticated using(
 archive_private.item_readable(archive_id,item_id) and
 (field_path not like 'comment_%' or actor_id=auth.uid() or value->>'author_id'=auth.uid()::text or archive_private.can_access(archive_id,'editor')));

create function public.save_item_field(p_archive_id uuid,p_item_id uuid,p_field text,p_value text,p_precision text,p_expected jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;before_value jsonb;after_value jsonb;v text:=trim(coalesce(p_value,''));begin
 if not archive_private.can_edit_item_places(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into i from public.archive_items where id=p_item_id for no key update;
 if p_field='date' then
  if p_precision is null or p_precision not in ('exact','month','year','approximate','decade','unknown') then raise exception 'invalid_date';end if;
  if (p_precision='unknown' and v<>'') or (p_precision='exact' and v!~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
   or (p_precision='month' and v!~ '^[0-9]{4}-[0-9]{2}$')
   or (p_precision in ('year','approximate') and v!~ '^[0-9]{4}$')
   or (p_precision='decade' and v!~ '^[0-9]{3}0s$') then raise exception 'invalid_date';end if;
  if p_precision='exact' then perform v::date;
  elsif p_precision='month' then perform (v||'-01')::date;
  elsif p_precision<>'unknown' and left(v,4)::integer<1 then raise exception 'invalid_date';end if;
  before_value:=jsonb_build_object('value',i.reported_date,'precision',i.date_precision);
  after_value:=jsonb_build_object('value',v,'precision',p_precision);
 elsif p_field='caption' then
  if length(v)>300 then raise exception 'invalid_caption';end if;
  before_value:=jsonb_build_object('value',i.title);after_value:=jsonb_build_object('value',v);
 else raise exception 'invalid_field';end if;
 if p_expected is distinct from before_value then raise exception 'field_changed_reload' using errcode='40001';end if;
 if before_value=after_value then return;end if;
 if p_field='date' then update public.archive_items set reported_date=v,date_precision=p_precision,last_edited_by=auth.uid(),updated_at=now() where id=i.id;
 else update public.archive_items set title=v,last_edited_by=auth.uid(),updated_at=now() where id=i.id;end if;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(i.archive_id,i.id,auth.uid(),'quick_'||p_field,jsonb_build_object('before',before_value,'after',after_value),'family_reported');
end $$;

create function public.post_item_comment(p_archive_id uuid,p_item_id uuid,p_body text,p_parent_id uuid,p_write_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;c public.comments;ident uuid;begin
 select * into i from public.archive_items where id=p_item_id and archive_id=p_archive_id for no key update;
 if i.id is null or i.lifecycle<>'active' or i.ingestion_status<>'ready' or i.archived_at is not null
 or not archive_private.can_access(p_archive_id,'commenter') or not archive_private.item_readable(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_write_id is null or p_body is null or length(trim(p_body)) not between 1 and 10000 then raise exception 'invalid_comment';end if;
 select * into c from public.comments where author_id=auth.uid() and client_write_id=p_write_id;
 if found then
  if c.item_id<>p_item_id or c.body<>trim(p_body) or c.parent_id is distinct from p_parent_id then raise exception 'comment_retry_conflict';end if;
  return c.id;
 end if;
 if p_parent_id is not null and not exists(select 1 from public.comments where id=p_parent_id and archive_id=p_archive_id and item_id=p_item_id and parent_id is null and archived_at is null) then raise exception 'invalid_reply';end if;
 insert into public.comments(archive_id,item_id,author_id,body,parent_id,client_write_id)
 values(p_archive_id,p_item_id,auth.uid(),trim(p_body),p_parent_id,p_write_id) returning id into ident;
 return ident;
end $$;
-- Keep the existing public primitive inside the same validation/lifecycle boundary.
create or replace function public.add_comment(p_archive_id uuid,p_item_id uuid,p_body text) returns uuid
language sql security definer set search_path=public,pg_temp as $$
 select public.post_item_comment(p_archive_id,p_item_id,p_body,null,gen_random_uuid())
$$;
create function public.change_item_comment(p_comment_id uuid,p_action text,p_body text,p_revision integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.comments;begin
 select * into c from public.comments where id=p_comment_id;
 if c.id is null then raise exception 'permission_denied' using errcode='42501';end if;
 perform 1 from public.archive_items where id=c.item_id for no key update;
 select * into c from public.comments where id=p_comment_id for update;
 if not archive_private.item_readable(c.archive_id,c.item_id) or not archive_private.can_access(c.archive_id,'commenter') then raise exception 'permission_denied' using errcode='42501';end if;
 if p_action='edit' then
  if c.author_id<>auth.uid() or c.archived_at is not null then raise exception 'permission_denied' using errcode='42501';end if;
  if p_body is null or length(trim(p_body)) not between 1 and 10000 then raise exception 'invalid_comment';end if;
 elsif p_action in ('archive','restore') then
  if not archive_private.can_access(c.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 else raise exception 'invalid_comment_action';end if;
 if p_revision is distinct from c.revision then raise exception 'comment_changed_reload' using errcode='40001';end if;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(c.archive_id,c.item_id,auth.uid(),'comment_'||p_action,jsonb_build_object('comment_id',c.id,'author_id',c.author_id,'before',to_jsonb(c),'after_body',case when p_action='edit' then trim(p_body) else c.body end),'family_reported');
 update public.comments set body=case when p_action='edit' then trim(p_body) else body end,
 edited_at=case when p_action='edit' then now() else edited_at end,
 archived_at=case when p_action='archive' then now() when p_action='restore' then null else archived_at end,
 archived_by=case when p_action='archive' then auth.uid() when p_action='restore' then null else archived_by end,
 revision=revision+1 where id=c.id;
end $$;
create unique index comment_promoted_once on public.provenance((value->>'comment_id')) where field_path='comment_promoted';
create function public.promote_item_comment(p_comment_id uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.comments;r uuid;begin
 select * into c from public.comments where id=p_comment_id;
 if c.id is null then raise exception 'permission_denied' using errcode='42501';end if;
 perform 1 from public.archive_items where id=c.item_id for no key update;
 select * into c from public.comments where id=p_comment_id for update;
 if not archive_private.can_access(c.archive_id,'editor') or not archive_private.item_readable(c.archive_id,c.item_id) or c.archived_at is not null then raise exception 'permission_denied' using errcode='42501';end if;
 if p_revision is distinct from c.revision then raise exception 'comment_changed_reload' using errcode='40001';end if;
 select source_recollection_id into r from public.provenance where field_path='comment_promoted' and value->>'comment_id'=c.id::text;
 if found then return r;end if;
 -- Preserve the original speaker/time; the Editor's decision is recorded separately below.
 insert into public.recollections(archive_id,item_id,contributor_id,original_text,recorded_at)
 values(c.archive_id,c.item_id,c.author_id,c.body,c.created_at) returning id into r;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status,source_recollection_id)
 values(c.archive_id,c.item_id,auth.uid(),'comment_promoted',jsonb_build_object('comment_id',c.id,'author_id',c.author_id,'comment_revision',c.revision,'original_created_at',c.created_at,'copied_body',c.body),'family_reported',r);
 return r;
end $$;
revoke all on function public.save_item_field(uuid,uuid,text,text,text,jsonb),public.post_item_comment(uuid,uuid,text,uuid,uuid),public.change_item_comment(uuid,text,text,integer),public.promote_item_comment(uuid,integer) from public,anon;
grant execute on function public.save_item_field(uuid,uuid,text,text,text,jsonb),public.post_item_comment(uuid,uuid,text,uuid,uuid),public.change_item_comment(uuid,text,text,integer),public.promote_item_comment(uuid,integer) to authenticated;
commit;
