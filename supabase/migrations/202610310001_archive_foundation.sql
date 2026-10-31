-- Additive foundation. No seed people, items, users, passwords, or family-specific IDs.
begin;
create schema if not exists archive_private;
revoke all on schema archive_private from public;
grant usage on schema archive_private to authenticated;
create type public.archive_role as enum ('viewer','commenter','contributor','editor','admin');
create type public.evidence_status as enum ('family_reported','uncertain','verified','ai_suggested');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '', email text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.archives (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 120),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=80),
 description text not null default '', cover_file_id uuid,
 owner_membership_id uuid not null, privacy text not null default 'members_only' check(privacy in ('members_only','owner_only')),
 settings jsonb not null default '{"defaultRole":"contributor","invitations":false,"ai":false,"transcription":false,"locations":false}',
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.people (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null references public.archives(id),
 slug text not null, display_name text not null check(length(trim(display_name)) between 1 and 200),
 category text not null default 'other' check(category in ('family','friend','other','unidentified')),
 biography text not null default '', lifespan text not null default '', portrait_file_id uuid,
 evidence_status public.evidence_status not null default 'family_reported',
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(archive_id,id), unique(archive_id,slug)
);
create table public.archive_memberships (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null references public.archives(id),
 profile_id uuid not null references public.profiles(id), role public.archive_role not null default 'viewer',
 status text not null default 'active' check(status in ('active','suspended','removed')),
 linked_person_id uuid, joined_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(archive_id,id), unique(archive_id,profile_id),
 foreign key(archive_id,linked_person_id) references public.people(archive_id,id)
);
alter table public.archives add constraint archives_owner_fk foreign key(id,owner_membership_id)
 references public.archive_memberships(archive_id,id) deferrable initially deferred;
create table public.invitations (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null references public.archives(id),
 name text not null, email text not null, role public.archive_role not null, linked_person_id uuid,
 status text not null default 'invited' check(status in ('invited','accepted','expired','revoked')),
 invited_by uuid references public.profiles(id), expires_at timestamptz not null, accepted_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(archive_id,id), foreign key(archive_id,linked_person_id) references public.people(archive_id,id)
);
-- Tokens belong in a non-exposed table; email delivery/redemption is not enabled in this pass.
create table archive_private.invitation_tokens (invitation_id uuid primary key references public.invitations(id), token_hash text not null unique);
create unique index invitations_pending_email on public.invitations(archive_id,lower(email)) where status='invited';
create table public.archive_items (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null references public.archives(id),
 client_capture_id uuid not null, title text not null check(length(title) between 1 and 300),
 kind text not null check(kind in ('Photograph','Letter','Document','Object','Postcard','Certificate','Artwork','Other')),
 notes text not null default '', reported_date text not null default '', date_precision text not null default 'unknown'
 check(date_precision in ('exact','approximate','year','unknown')), reported_place text not null default '', people_text text not null default '',
 evidence_status public.evidence_status not null default 'family_reported',
 ingestion_status text not null default 'uploading' check(ingestion_status in ('uploading','ready','failed')),
 contributed_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(archive_id,id), unique(archive_id,contributed_by,client_capture_id)
);
create table public.archive_item_files (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null,
 purpose text not null check(purpose in ('original','audio_original','display','thumbnail','transcription_source')),
 parent_original_id uuid, bucket_id text not null, storage_path text not null unique,
 original_filename text not null, mime_type text not null, byte_size bigint not null check(byte_size>0 and byte_size<=31457280),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), width integer check(width>0), height integer check(height>0),
 page_order integer not null check(page_order>=0), page_role text not null default 'image',
 status text not null default 'reserved' check(status in ('reserved','stored')),
 uploaded_by uuid references public.profiles(id), created_at timestamptz not null default now(),
 unique(archive_id,id), unique(archive_id,item_id,id), unique(item_id,page_order),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id),
 foreign key(archive_id,item_id,parent_original_id) references public.archive_item_files(archive_id,item_id,id),
 check((purpose in ('original','audio_original') and parent_original_id is null) or (purpose not in ('original','audio_original') and parent_original_id is not null)),
 check((purpose='audio_original' and bucket_id='archive-audio') or (purpose='original' and bucket_id='archive-originals') or (purpose not in ('original','audio_original') and bucket_id='archive-derived'))
);
alter table public.archives add constraint archives_cover_fk foreign key(id,cover_file_id) references public.archive_item_files(archive_id,id);
alter table public.people add constraint people_portrait_fk foreign key(archive_id,portrait_file_id) references public.archive_item_files(archive_id,id);
create table public.recollections (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null,
 contributor_id uuid references public.profiles(id), original_text text not null default '' check(length(original_text)<=20000),
 recorded_at timestamptz not null default now(), evidence_status public.evidence_status not null default 'family_reported',
 created_at timestamptz not null default now(), unique(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id)
);
create table public.recollection_audio (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, recollection_id uuid not null, original_file_id uuid not null,
 duration_ms integer check(duration_ms>=0), created_at timestamptz not null default now(), unique(archive_id,id),
 foreign key(archive_id,recollection_id) references public.recollections(archive_id,id),
 foreign key(archive_id,original_file_id) references public.archive_item_files(archive_id,id)
);
create table public.transcriptions (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null, original_file_id uuid not null,
 modality text not null check(modality in ('speech','handwriting')), raw_ai_text text not null, reviewed_text text,
 review_status text not null default 'pending' check(review_status in ('pending','reviewed','rejected')),
 provider text not null, model text not null, confidence numeric check(confidence between 0 and 1),
 processed_at timestamptz not null default now(), reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
 version integer not null default 1 check(version>0), unique(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id),
 foreign key(archive_id,original_file_id) references public.archive_item_files(archive_id,id)
);
create table public.metadata_suggestions (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null,
 source_file_id uuid, source_recollection_id uuid, field_path text not null, suggested_value jsonb not null,
 provider text not null, model text not null, confidence numeric check(confidence between 0 and 1),
 status text not null default 'pending' check(status in ('pending','accepted','rejected','superseded')),
 reviewed_by uuid references public.profiles(id), reviewed_at timestamptz, created_at timestamptz not null default now(), unique(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id),
 foreign key(archive_id,source_file_id) references public.archive_item_files(archive_id,id),
 foreign key(archive_id,source_recollection_id) references public.recollections(archive_id,id)
);
create table public.comments (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null,
 author_id uuid not null references public.profiles(id), body text not null check(length(trim(body)) between 1 and 10000),
 created_at timestamptz not null default now(), unique(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id)
);
create table public.identifications (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null, person_id uuid,
 proposed_by uuid not null references public.profiles(id), proposed_name text not null default '',
 status text not null default 'reported' check(status in ('reported','accepted','rejected')),
 created_at timestamptz not null default now(), unique(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id),
 foreign key(archive_id,person_id) references public.people(archive_id,id)
);
create table public.processing_jobs (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null, item_id uuid not null, stage text not null,
 status text not null default 'queued' check(status in ('queued','processing','needs_review','complete','failed')),
 attempts integer not null default 0, error_code text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(archive_id,id), unique(item_id,stage), foreign key(archive_id,item_id) references public.archive_items(archive_id,id)
);
create table public.activity_log (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null references public.archives(id), actor_id uuid references public.profiles(id),
 event_type text not null, item_id uuid, summary text not null, created_at timestamptz not null default now(), unique(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id)
);
create table public.provenance (
 id uuid primary key default gen_random_uuid(), archive_id uuid not null references public.archives(id), item_id uuid,
 actor_id uuid references public.profiles(id), field_path text not null, value jsonb not null,
 evidence_status public.evidence_status not null, source_recollection_id uuid, created_at timestamptz not null default now(), unique(archive_id,id),
 foreign key(archive_id,item_id) references public.archive_items(archive_id,id),
 foreign key(archive_id,source_recollection_id) references public.recollections(archive_id,id)
);
create index memberships_profile on public.archive_memberships(profile_id,archive_id,status);
create index items_recent on public.archive_items(archive_id,created_at desc,id);
create index files_item on public.archive_item_files(archive_id,item_id);
create index people_name on public.people(archive_id,display_name);
create index jobs_pending on public.processing_jobs(archive_id,status,created_at);
create index recollections_item on public.recollections(archive_id,item_id);
create index activity_recent on public.activity_log(archive_id,created_at desc);

-- SECURITY DEFINER helpers have a fixed search_path and query membership without RLS recursion.
create function archive_private.role_rank(r public.archive_role) returns integer language sql immutable as $$
 select case r when 'viewer' then 1 when 'commenter' then 2 when 'contributor' then 3 when 'editor' then 4 when 'admin' then 5 else 0 end
$$;
create function archive_private.can_access(a uuid, minimum public.archive_role default 'viewer') returns boolean
 language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from public.archive_memberships m join public.archives ar on ar.id=m.archive_id
 where ar.id=a and m.profile_id=auth.uid() and m.status='active'
 and (ar.privacy='members_only' or ar.owner_membership_id=m.id)
 and archive_private.role_rank(m.role)>=archive_private.role_rank(minimum))
$$;
create function archive_private.item_readable(a uuid, i uuid) returns boolean
 language sql stable security definer set search_path=public,pg_temp as $$
 select archive_private.can_access(a) and exists(select 1 from public.archive_items x where x.archive_id=a and x.id=i
 and (x.ingestion_status='ready' or x.contributed_by=auth.uid() or archive_private.can_access(a,'editor')))
$$;
create function archive_private.profile_readable(p uuid) returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p=auth.uid() or exists(select 1 from public.archive_memberships m where m.profile_id=p and archive_private.can_access(m.archive_id,'admin'))
$$;
create function archive_private.on_auth_user() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
 begin insert into public.profiles(id,display_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',''),coalesce(new.email,''))
 on conflict(id) do update set email=excluded.email,updated_at=now(); return new; end
$$;
create trigger archive_profile_on_auth after insert or update of email on auth.users for each row execute function archive_private.on_auth_user();
-- Existing authenticated accounts get profiles only, never historical demo content.
insert into public.profiles(id,display_name,email) select id,coalesce(raw_user_meta_data->>'display_name',''),coalesce(email,'') from auth.users on conflict(id) do nothing;

alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(archive_private.profile_readable(id));
-- All writes to sensitive tables go through narrow RPCs; grants are explicit.
revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
do $$ declare t text; begin
 foreach t in array array['archives','archive_memberships','invitations','people','archive_items','archive_item_files','recollections','recollection_audio','transcriptions','metadata_suggestions','comments','identifications','processing_jobs','activity_log','provenance'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t='archives' then execute 'create policy archive_read on public.archives for select to authenticated using(archive_private.can_access(id))';
 elsif t in ('archive_items') then execute 'create policy item_read on public.archive_items for select to authenticated using(archive_private.item_readable(archive_id,id))';
 elsif t in ('archive_item_files','recollections','transcriptions','metadata_suggestions','comments','identifications','processing_jobs','provenance') then
 execute format('create policy content_read on public.%I for select to authenticated using(archive_private.item_readable(archive_id,item_id))',t);
 elsif t='invitations' then execute 'create policy invitations_admin on public.invitations for select to authenticated using(archive_private.can_access(archive_id,''admin''))';
 else execute format('create policy archive_read on public.%I for select to authenticated using(archive_private.can_access(archive_id))',t); end if;
 end loop; end $$;
-- Recollection audio references its readable item through the recollection; no public assets.

create function public.create_archive(p_name text,p_slug text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare a uuid:=gen_random_uuid(); m uuid:=gen_random_uuid(); begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'profile_required' using errcode='42501'; end if;
 insert into public.archives(id,name,slug,owner_membership_id,created_by) values(a,trim(p_name),p_slug,m,auth.uid());
 insert into public.archive_memberships(id,archive_id,profile_id,role) values(m,a,auth.uid(),'admin');
 insert into public.activity_log(archive_id,actor_id,event_type,summary) values(a,auth.uid(),'archive_created','Archive created by its authenticated owner.');
 return a; end
$$;
create function public.update_archive(p_archive_id uuid,p_name text,p_slug text,p_description text,p_privacy text,p_settings jsonb,p_cover_file_id uuid default null)
 returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin
 if not archive_private.can_access(p_archive_id,'admin') then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_settings->>'defaultRole' not in ('viewer','commenter','contributor') then raise exception 'invalid_default_role'; end if;
 -- Processing stays disabled until a separately reviewed worker/provider integration exists.
 update public.archives set name=trim(p_name),slug=p_slug,description=left(p_description,1500),privacy=p_privacy,
 settings=jsonb_build_object('defaultRole',coalesce(p_settings->>'defaultRole','contributor'),'invitations',false,'ai',false,'transcription',false,'locations',false),
 cover_file_id=p_cover_file_id,updated_at=now() where id=p_archive_id;
 insert into public.activity_log(archive_id,actor_id,event_type,summary) values(p_archive_id,auth.uid(),'archive_updated','Archive settings updated.'); end
$$;
create function public.manage_member(p_archive_id uuid,p_member_id uuid,p_role public.archive_role,p_status text,p_person_id uuid default null)
 returns void language plpgsql security definer set search_path=public,pg_temp as $$
 declare ar public.archives; begin
 select * into ar from public.archives where id=p_archive_id for update;
 if not archive_private.can_access(p_archive_id,'admin') then raise exception 'permission_denied' using errcode='42501'; end if;
 if p_member_id=ar.owner_membership_id and (p_role<>'admin' or p_status<>'active') then raise exception 'owner_protected'; end if;
 update public.archive_memberships set role=p_role,status=p_status,linked_person_id=p_person_id,updated_at=now() where archive_id=p_archive_id and id=p_member_id;
 insert into public.activity_log(archive_id,actor_id,event_type,summary) values(p_archive_id,auth.uid(),'membership_updated','Membership updated; historical contributions retained.'); end
$$;
create function public.save_person(p_archive_id uuid,p_name text,p_category text,p_biography text default '',p_lifespan text default '')
 returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare p uuid:=gen_random_uuid(); begin
 if not archive_private.can_access(p_archive_id,'editor') then raise exception 'permission_denied' using errcode='42501'; end if;
 insert into public.people(id,archive_id,slug,display_name,category,biography,lifespan,created_by)
 values(p,p_archive_id,p::text,trim(p_name),p_category,left(p_biography,10000),left(p_lifespan,150),auth.uid());return p; end
$$;
create function public.add_recollection(p_archive_id uuid,p_item_id uuid,p_text text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare r uuid:=gen_random_uuid(); begin
 if not archive_private.can_access(p_archive_id,'commenter') or not archive_private.item_readable(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501'; end if;
 insert into public.recollections(id,archive_id,item_id,contributor_id,original_text) values(r,p_archive_id,p_item_id,auth.uid(),p_text);
 insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status,source_recollection_id)
 values(p_archive_id,p_item_id,auth.uid(),'recollection',to_jsonb(p_text),'family_reported',r);return r;end
$$;
create function public.add_comment(p_archive_id uuid,p_item_id uuid,p_body text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare c uuid:=gen_random_uuid();begin
 if not archive_private.can_access(p_archive_id,'commenter') or not archive_private.item_readable(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 insert into public.comments(id,archive_id,item_id,author_id,body) values(c,p_archive_id,p_item_id,auth.uid(),p_body);return c;end
$$;
create function public.propose_identification(p_archive_id uuid,p_item_id uuid,p_person_id uuid,p_name text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
 declare i uuid:=gen_random_uuid();begin
 if not archive_private.can_access(p_archive_id,'commenter') or not archive_private.item_readable(p_archive_id,p_item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 insert into public.identifications(id,archive_id,item_id,person_id,proposed_by,proposed_name) values(i,p_archive_id,p_item_id,p_person_id,auth.uid(),left(p_name,200));return i;end
$$;
create function public.review_transcription(p_archive_id uuid,p_id uuid,p_text text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
 begin if not archive_private.can_access(p_archive_id,'editor') then raise exception 'permission_denied' using errcode='42501';end if;
 update public.transcriptions set reviewed_text=p_text,review_status='reviewed',reviewed_by=auth.uid(),reviewed_at=now() where archive_id=p_archive_id and id=p_id;
 insert into public.activity_log(archive_id,actor_id,event_type,summary) values(p_archive_id,auth.uid(),'transcription_reviewed','Reviewed text saved; raw provider output unchanged.');end
$$;
-- Never grant execution on every function in a schema: expose only reviewed RPCs.
revoke all on all functions in schema archive_private from public,anon,authenticated;
grant execute on function archive_private.can_access(uuid,public.archive_role),archive_private.item_readable(uuid,uuid),archive_private.profile_readable(uuid) to authenticated;
revoke all on function public.create_archive(text,text),public.update_archive(uuid,text,text,text,text,jsonb,uuid),public.manage_member(uuid,uuid,public.archive_role,text,uuid),public.save_person(uuid,text,text,text,text),public.add_recollection(uuid,uuid,text),public.add_comment(uuid,uuid,text),public.propose_identification(uuid,uuid,uuid,text),public.review_transcription(uuid,uuid,text) from public,anon;
grant execute on function public.create_archive(text,text),public.update_archive(uuid,text,text,text,text,jsonb,uuid),public.manage_member(uuid,uuid,public.archive_role,text,uuid),public.save_person(uuid,text,text,text,text),public.add_recollection(uuid,uuid,text),public.add_comment(uuid,uuid,text),public.propose_identification(uuid,uuid,uuid,text),public.review_transcription(uuid,uuid,text) to authenticated;
commit;
