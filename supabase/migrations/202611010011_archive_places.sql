begin;
-- Archive-local Places and explicit associations only; no historical name/text backfill.
create table public.places (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null references public.archives(id),
 name text not null check(length(trim(name)) between 1 and 200),
 locality text not null default '' check(length(locality)<=300), city text not null default '' check(length(city)<=300),
 region text not null default '' check(length(region)<=300), country text not null default '' check(length(country)<=300),
 latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180),
 notes text not null default '' check(length(notes)<=10000), created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(archive_id,id)
);
create index places_archive_name on public.places(archive_id,name,id);
create table public.item_places (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null, place_id uuid not null,
 role text not null default 'primary' check(role in ('primary','written_in','sent_to','depicted','related')),
 status text not null default 'reported' check(status in ('reported','confirmed','removed')),
 source text not null check(source in ('human_report','legacy_text')), reported_text text not null default '',
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id) on delete cascade,
 foreign key(archive_id,place_id) references public.places(archive_id,id)
);
create unique index item_place_active_once on public.item_places(item_id,place_id,role) where status<>'removed';
create unique index item_primary_place_once on public.item_places(item_id) where role='primary' and status<>'removed';
create index item_places_archive_place on public.item_places(archive_id,place_id,item_id) where status<>'removed';
create index item_places_item_history on public.item_places(archive_id,item_id,id);
alter table public.places enable row level security;
alter table public.places force row level security;
alter table public.item_places enable row level security;
alter table public.item_places force row level security;
revoke all on public.places,public.item_places from public,anon,authenticated;
grant select on public.places,public.item_places to authenticated;
create policy place_read on public.places for select to authenticated using(archive_private.can_access(archive_id));
create policy item_place_read on public.item_places for select to authenticated using(archive_private.item_readable(archive_id,item_id));
create trigger guard_item_lifecycle before insert or update on public.item_places for each row execute function archive_private.guard_item_content();

create function archive_private.write_place(a uuid,p uuid,d jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;before_value jsonb;begin
 if d is null or jsonb_typeof(d)<>'object' or d->>'name' is null or length(trim(d->>'name')) not between 1 and 200 then raise exception 'invalid_place';end if;
 if p is null then
 insert into public.places(archive_id,name,locality,city,region,country,latitude,longitude,notes,created_by)
 values(a,trim(d->>'name'),coalesce(d->>'locality',''),coalesce(d->>'city',''),coalesce(d->>'region',''),coalesce(d->>'country',''),nullif(d->>'latitude','')::double precision,nullif(d->>'longitude','')::double precision,coalesce(d->>'notes',''),auth.uid()) returning id into result;
 else
 select to_jsonb(x) into before_value from public.places x where archive_id=a and id=p for update;
 if not found then raise exception 'permission_denied' using errcode='42501';end if;
 update public.places set name=trim(d->>'name'),locality=coalesce(d->>'locality',''),city=coalesce(d->>'city',''),region=coalesce(d->>'region',''),country=coalesce(d->>'country',''),latitude=nullif(d->>'latitude','')::double precision,longitude=nullif(d->>'longitude','')::double precision,notes=coalesce(d->>'notes',''),updated_at=now() where id=p;
 result:=p;
 end if;
 insert into public.provenance(archive_id,actor_id,field_path,value,evidence_status) values(a,auth.uid(),case when p is null then 'place_created' else 'place_updated' end,jsonb_build_object('place_id',result,'before',before_value,'after',d),'family_reported');
 return result;
end $$;
create function public.save_archive_place(p_archive_id uuid,p_place_id uuid,p_details jsonb) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not archive_private.can_access(p_archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 return archive_private.write_place(p_archive_id,p_place_id,p_details);
end $$;
create function archive_private.can_edit_item_places(a uuid,i uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare item public.archive_items;begin
 select * into item from public.archive_items where archive_id=a and id=i for no key update;
 return item.id is not null and item.lifecycle='active' and item.ingestion_status='ready' and archive_private.item_readable(a,i)
 and (archive_private.can_access(a,'editor') or (archive_private.can_access(a,'contributor') and item.contributed_by=auth.uid() and item.evidence_status<>'verified' and item.archived_at is null));
end $$;
create function public.link_item_place(p_archive_id uuid,p_item_id uuid,p_place_id uuid,p_role text default 'primary',p_from_report boolean default false) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare current_link public.item_places;ident uuid;item public.archive_items;begin
 if not archive_private.can_edit_item_places(p_archive_id,p_item_id) or (p_from_report and not archive_private.can_access(p_archive_id,'editor')) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_role is null or p_role not in ('primary','written_in','sent_to','depicted','related') or p_from_report is null then raise exception 'invalid_place_link';end if;
 if not exists(select 1 from public.places where archive_id=p_archive_id and id=p_place_id) then raise exception 'place_archive_mismatch' using errcode='23503';end if;
 select id into ident from public.item_places where item_id=p_item_id and place_id=p_place_id and role=p_role and status<>'removed';
 if found then return ident;end if;
 if p_role='primary' then
 select * into current_link from public.item_places where item_id=p_item_id and role='primary' and status<>'removed';
 if found then
 if not archive_private.can_access(p_archive_id,'editor') and (current_link.status='confirmed' or current_link.created_by<>auth.uid()) then raise exception 'editor_required' using errcode='42501';end if;
 update public.item_places set status='removed',reviewed_by=auth.uid(),reviewed_at=now() where id=current_link.id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status) values(p_archive_id,p_item_id,auth.uid(),'item_place_replaced',to_jsonb(current_link),'family_reported');
 end if;
 end if;
 select * into item from public.archive_items where id=p_item_id;
 insert into public.item_places(archive_id,item_id,place_id,role,source,reported_text,created_by)
 values(p_archive_id,p_item_id,p_place_id,p_role,case when p_from_report then 'legacy_text' else 'human_report' end,coalesce(item.reported_place,''),auth.uid()) returning id into ident;
 update public.archive_items set updated_at=now() where id=p_item_id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(p_archive_id,p_item_id,auth.uid(),'item_place_linked',jsonb_build_object('link_id',ident,'place_id',p_place_id,'role',p_role,'reported_text',item.reported_place,'item_contributor_id',item.contributed_by,'explicit_legacy_link',p_from_report),'family_reported');
 return ident;
end $$;
create function public.create_item_place(p_archive_id uuid,p_item_id uuid,p_details jsonb,p_from_report boolean default false) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare place uuid;begin
 if not archive_private.can_edit_item_places(p_archive_id,p_item_id) or (p_from_report and not archive_private.can_access(p_archive_id,'editor')) then raise exception 'permission_denied' using errcode='42501';end if;
 place:=archive_private.write_place(p_archive_id,null,p_details);
 perform public.link_item_place(p_archive_id,p_item_id,place,'primary',p_from_report);
 return place;
end $$;
create function public.review_item_place(p_link_id uuid,p_action text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare link public.item_places;editor boolean;begin
 select * into link from public.item_places where id=p_link_id;
 if link.id is null or not archive_private.can_edit_item_places(link.archive_id,link.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 select * into link from public.item_places where id=p_link_id for update;
 editor:=archive_private.can_access(link.archive_id,'editor');
 if not editor and not (p_action='remove' and link.status='reported' and link.created_by=auth.uid()) then raise exception 'permission_denied' using errcode='42501';end if;
 if p_action is null or p_action not in ('confirm','remove') then raise exception 'invalid_place_review';end if;
 if link.status='removed' then if p_action='remove' then return;else raise exception 'place_link_removed';end if;end if;
 if link.status='confirmed' and p_action='confirm' then return;end if;
 update public.item_places set status=case when p_action='confirm' then 'confirmed' else 'removed' end,reviewed_by=auth.uid(),reviewed_at=now() where id=link.id;
 update public.archive_items set updated_at=now() where id=link.item_id;
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
 values(link.archive_id,link.item_id,auth.uid(),'item_place_'||p_action,to_jsonb(link),case when p_action='confirm' then 'verified'::public.evidence_status else 'family_reported'::public.evidence_status end);
end $$;
revoke all on function archive_private.write_place(uuid,uuid,jsonb),archive_private.can_edit_item_places(uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_archive_place(uuid,uuid,jsonb),public.link_item_place(uuid,uuid,uuid,text,boolean),public.create_item_place(uuid,uuid,jsonb,boolean),public.review_item_place(uuid,text) from public,anon;
grant execute on function public.save_archive_place(uuid,uuid,jsonb),public.link_item_place(uuid,uuid,uuid,text,boolean),public.create_item_place(uuid,uuid,jsonb,boolean),public.review_item_place(uuid,text) to authenticated;

-- Recognize the reviewed ON DELETE CASCADE relation during deletion preflight.
-- Unknown future dependencies on item_places still block before any Storage cleanup.
create or replace function public.begin_item_deletion(p_item_id uuid,p_version text,p_confirmation text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.archive_items;snap jsonb;d public.item_deletions;bad text;begin
 select * into i from public.archive_items where id=p_item_id for no key update;
 if i.id is null or not archive_private.can_access(i.archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_item_id::text,9));
 if p_confirmation is distinct from 'DELETE' then raise exception 'confirmation_required';end if;
 select * into d from public.item_deletions where item_id=i.id;
 if d.status='pending' and i.lifecycle='deleting' then return to_jsonb(d);end if;
 if i.archived_at is null or i.ingestion_status<>'ready' then raise exception 'archive_before_delete';end if;
 if exists(select 1 from public.archive_items where split_from=i.id) then raise exception 'split_context_has_children';end if;
 if exists(select 1 from public.preview_attempts where item_id=i.id and updated_at>now()-interval '75 seconds') then raise exception 'preview_recently_active';end if;
 -- Unknown future dependencies must be reviewed BEFORE any Storage deletion.
 select c.conrelid::regclass::text into bad from pg_constraint c where c.contype='f' and c.confrelid in ('public.archive_items'::regclass,'public.archive_item_files'::regclass,'public.recollections'::regclass,'public.recollection_audio'::regclass,'public.transcriptions'::regclass,'public.metadata_suggestions'::regclass,'public.comments'::regclass,'public.identifications'::regclass,'public.processing_jobs'::regclass,'public.provenance'::regclass,'public.preview_attempts'::regclass,'public.image_sets'::regclass,'public.import_batch_items'::regclass,'public.item_places'::regclass)
 and c.conrelid not in (select t.oid from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='public' and t.relname=any(array['archive_items','archive_item_files','archives','people','recollections','recollection_audio','transcriptions','metadata_suggestions','comments','identifications','processing_jobs','activity_log','provenance','import_batch_items','preview_attempts','image_sets','item_places','audio_item_links','audio_people'])) limit 1;
 if bad is not null then raise exception 'unreviewed_dependency';end if;
 if exists(select 1 from public.recollection_audio r where r.recollection_id in (select id from public.recollections where item_id=i.id)
 and r.original_file_id not in (select id from public.archive_item_files where item_id=i.id)) then raise exception 'cross_item_audio_dependency';end if;
 if exists(select 1 from public.recollection_audio r where r.original_file_id in (select id from public.archive_item_files where item_id=i.id)
 and r.recollection_id not in (select id from public.recollections where item_id=i.id)) then raise exception 'cross_item_audio_dependency';end if;
 if exists(select 1 from public.transcriptions where original_file_id in (select id from public.archive_item_files where item_id=i.id) and item_id<>i.id) then raise exception 'cross_item_source_dependency';end if;
 snap:=public.item_management_snapshot(i.id);
 if p_version is distinct from (snap->>'version') then raise exception 'item_changed_review_again';end if;
 insert into public.item_deletions(archive_id,item_id,actor_id,manifest,remaining,counts) values(i.archive_id,i.id,auth.uid(),snap->'files',snap->'files',snap->'counts') returning * into d;
 update public.archive_items set lifecycle='deleting',updated_at=now() where id=i.id;
 insert into public.item_management_events(archive_id,item_id,actor_id,event,counts) values(i.archive_id,i.id,auth.uid(),'deletion_started',d.counts);
 return to_jsonb(d);
end $$;
commit;
