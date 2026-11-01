begin;
-- Reuse identifications as the item/Person relationship. No name-based backfill.
-- Original proposed_name, proposed_by and created_at remain the reported evidence.
alter table public.identifications add column role_context text not null default '' check(length(role_context)<=300);
alter table public.identifications add column source text not null default 'legacy_report' check(source in ('legacy_report','human_report'));
alter table public.identifications add column confidence numeric check(confidence between 0 and 1);
alter table public.identifications add column linked_by uuid references public.profiles(id);
alter table public.identifications add column linked_at timestamptz;
alter table public.identifications add column reviewed_by uuid references public.profiles(id);
alter table public.identifications add column reviewed_at timestamptz;
create index identifications_person_items on public.identifications(archive_id,person_id,item_id) where person_id is not null and status in ('reported','accepted');

create or replace function public.propose_identification(p_archive_id uuid,p_item_id uuid,p_person_id uuid,p_name text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare ident uuid:=gen_random_uuid();person public.people;item public.archive_items;begin
 select * into item from public.archive_items where id=p_item_id and archive_id=p_archive_id for no key update;
 if item.id is null or item.lifecycle<>'active' or item.ingestion_status<>'ready'
 or not archive_private.can_access(p_archive_id,'commenter') or not archive_private.item_readable(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_person_id is not null then
 select * into person from public.people where id=p_person_id and archive_id=p_archive_id;
 if person.id is null then raise exception 'person_archive_mismatch' using errcode='23503';end if;
 select id into ident from public.identifications where archive_id=p_archive_id and item_id=p_item_id and person_id=p_person_id and status in ('reported','accepted') order by created_at,id limit 1;
 if found then return ident;end if;
 ident:=gen_random_uuid();
 elsif p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'invalid_identification';end if;
 insert into public.identifications(id,archive_id,item_id,person_id,proposed_by,proposed_name,source,linked_by,linked_at)
 values(ident,p_archive_id,p_item_id,p_person_id,auth.uid(),case when p_person_id is null then trim(p_name) else person.display_name end,'human_report',case when p_person_id is not null then auth.uid() end,case when p_person_id is not null then now() end);
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(p_archive_id,p_item_id,auth.uid(),'identification_reported',jsonb_build_object('identification_id',ident,'person_id',p_person_id,'reported_name',case when p_person_id is null then trim(p_name) else person.display_name end,'source','human_report'),'family_reported');
 return ident;
end $$;

create function public.link_identification(p_identification_id uuid,p_person_id uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare ident public.identifications;begin
 select * into ident from public.identifications where id=p_identification_id;
 if ident.id is null then raise exception 'permission_denied' using errcode='42501';end if;
 perform 1 from public.archive_items where id=ident.item_id for no key update;
 select * into ident from public.identifications where id=p_identification_id for update;
 if not archive_private.can_access(ident.archive_id,'editor') or not archive_private.item_readable(ident.archive_id,ident.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if ident.status='rejected' or p_person_id is null or (ident.person_id is not null and ident.person_id<>p_person_id) then raise exception 'identification_state_conflict';end if;
 if not exists(select 1 from public.people where id=p_person_id and archive_id=ident.archive_id) then raise exception 'person_archive_mismatch' using errcode='23503';end if;
 if ident.person_id=p_person_id then return;end if;
 update public.identifications set person_id=p_person_id,linked_by=auth.uid(),linked_at=now() where id=ident.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(ident.archive_id,ident.item_id,auth.uid(),'identification_linked',jsonb_build_object('identification_id',ident.id,'person_id',p_person_id,'original_reported_name',ident.proposed_name,'original_proposed_by',ident.proposed_by,'original_created_at',ident.created_at),'family_reported');
end $$;

create function public.review_identification(p_identification_id uuid,p_action text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare ident public.identifications;editor boolean;begin
 select * into ident from public.identifications where id=p_identification_id;
 if ident.id is null then raise exception 'permission_denied' using errcode='42501';end if;
 perform 1 from public.archive_items where id=ident.item_id for no key update;
 select * into ident from public.identifications where id=p_identification_id for update;
 editor:=archive_private.can_access(ident.archive_id,'editor');
 if not archive_private.item_readable(ident.archive_id,ident.item_id) or not (editor or (p_action='remove' and ident.status='reported' and ident.proposed_by=auth.uid() and archive_private.can_access(ident.archive_id,'commenter'))) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_action is null or p_action not in ('confirm','remove') or (p_action='confirm' and (ident.person_id is null or ident.status='rejected')) then raise exception 'invalid_identification_review';end if;
 if (p_action='remove' and ident.status='rejected') or (p_action='confirm' and ident.status='accepted') then return;end if;
 update public.identifications set status=case when p_action='confirm' then 'accepted' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now() where id=ident.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(ident.archive_id,ident.item_id,auth.uid(),'identification_'||p_action,jsonb_build_object('identification_id',ident.id,'person_id',ident.person_id,'previous_status',ident.status,'original_proposed_by',ident.proposed_by),case when p_action='confirm' then 'verified'::public.evidence_status else 'family_reported'::public.evidence_status end);
end $$;

create function public.create_identified_person(p_archive_id uuid,p_item_id uuid,p_name text,p_category text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.archive_items;person uuid:=gen_random_uuid();begin
 select * into item from public.archive_items where id=p_item_id and archive_id=p_archive_id for no key update;
 if item.id is null or item.lifecycle<>'active' or item.ingestion_status<>'ready' or not archive_private.item_readable(p_archive_id,p_item_id)
 or not (archive_private.can_access(p_archive_id,'editor') or (archive_private.can_access(p_archive_id,'contributor') and item.contributed_by=auth.uid() and item.evidence_status<>'verified')) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 200 or p_category is null or p_category not in ('family','friend','other','unidentified') then raise exception 'invalid_person';end if;
 insert into public.people(id,archive_id,slug,display_name,category,created_by) values(person,p_archive_id,person::text,trim(p_name),p_category,auth.uid());
 perform public.propose_identification(p_archive_id,p_item_id,person,null);
 return person;
end $$;
revoke all on function public.link_identification(uuid,uuid),public.review_identification(uuid,text),public.create_identified_person(uuid,uuid,text,text),public.propose_identification(uuid,uuid,uuid,text) from public,anon;
grant execute on function public.link_identification(uuid,uuid),public.review_identification(uuid,text),public.create_identified_person(uuid,uuid,text,text),public.propose_identification(uuid,uuid,uuid,text) to authenticated;
commit;
