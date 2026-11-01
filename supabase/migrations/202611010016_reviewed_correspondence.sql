begin;
-- Keep explicitly reviewed From/To wording without forcing a canonical Person.
-- Existing tables, source bytes, earlier decisions and provider runs are unchanged.
create or replace function public.apply_document_suggestions(p_run_id uuid,p_selections jsonb,p_expected_date jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.document_runs;s public.metadata_suggestions;x jsonb;v text;k text;role_name text;canonical uuid;ident uuid;decision jsonb;begin
 select * into r from public.document_runs where id=p_run_id;
 if r.id is null or not archive_private.can_access(r.archive_id,'editor') or not archive_private.can_process_document(r.item_id) then raise exception 'permission_denied' using errcode='42501';end if;
 if r.status<>'complete' or r.operation<>'transcribe' or r.source_version is distinct from archive_private.document_snapshot(r.item_id)->>'version' then raise exception 'document_source_changed';end if;
 if p_selections is null or length(p_selections::text)>300000 or jsonb_typeof(p_selections) is distinct from 'array' or jsonb_array_length(p_selections) not between 1 and 60 then raise exception 'invalid_selection';end if;
 if (select count(*) from jsonb_array_elements(p_selections))<>(select count(distinct picked.value->>'id') from jsonb_array_elements(p_selections) picked(value))
 or (select count(*) from jsonb_array_elements(p_selections) picked(value) where picked.value->>'context'='written_date' and picked.value->>'action'='accept')>1 then raise exception 'invalid_selection';end if;
 for x in select * from jsonb_array_elements(p_selections) loop
  select * into s from public.metadata_suggestions where id=(x->>'id')::uuid and document_run_id=r.id and item_id=r.item_id for update;
  if s.id is null or x->>'action' not in ('accept','reject') or x->>'action' is null then raise exception 'invalid_selection';end if;
  if s.status<>'pending' then
   if s.reviewed_value=x then continue;else raise exception 'suggestion_already_reviewed';end if;
  end if;
  if x->>'action'='accept' then
   k:=s.suggested_value->>'kind';v:=trim(coalesce(x->>'value',''));role_name:=x->>'context';
   if length(v) not between 1 and 2000 then raise exception 'invalid_selection';end if;
   if k in ('person','sender','recipient') then
    if role_name is null or role_name not in ('mentioned','sender','recipient') then raise exception 'invalid_document_role';end if;
    canonical:=nullif(x->>'canonical_id','')::uuid;
    if coalesce((x->>'text_only')::boolean,false) then
     if k not in ('sender','recipient') or role_name<>k or canonical is not null or coalesce((x->>'create')::boolean,false) then raise exception 'invalid_correspondence_text';end if;
     -- The reviewed wording is retained in reviewed_value and the existing audit event below.
    else
    if canonical is null and coalesce((x->>'create')::boolean,false) then
     if exists(select 1 from public.people where archive_id=r.archive_id and lower(regexp_replace(trim(display_name),'\s+',' ','g'))=lower(regexp_replace(v,'\s+',' ','g'))) then raise exception 'choose_existing_person';end if;
     canonical:=public.create_identified_person(r.archive_id,r.item_id,v,'other');
    end if;
    if canonical is null then raise exception 'canonical_person_required';end if;
    ident:=public.propose_identification(r.archive_id,r.item_id,canonical,v);
    update public.identifications set role_context=case when role_name=any(regexp_split_to_array(role_context,'; *')) then role_context else concat_ws('; ',nullif(role_context,''),role_name) end where id=ident;
    perform public.review_identification(ident,'confirm');
    end if;
   elsif k='place' then
    if role_name is null or role_name not in ('written_in','sent_to','related') then raise exception 'invalid_document_role';end if;
    canonical:=nullif(x->>'canonical_id','')::uuid;
    if canonical is null and coalesce((x->>'create')::boolean,false) then
     if exists(select 1 from public.places where archive_id=r.archive_id and lower(regexp_replace(trim(name),'\s+',' ','g'))=lower(regexp_replace(v,'\s+',' ','g'))) then raise exception 'choose_existing_place';end if;
     canonical:=archive_private.write_place(r.archive_id,null,jsonb_build_object('name',v));
    end if;
    if canonical is null then raise exception 'canonical_place_required';end if;
    ident:=public.link_item_place(r.archive_id,r.item_id,canonical,role_name,false);
    perform public.review_item_place(ident,'confirm');
   elsif k='date' then
    if role_name='written_date' then perform public.save_item_field(r.archive_id,r.item_id,'date',v,x->>'precision',p_expected_date);
    elsif role_name is distinct from 'mentioned_date' then raise exception 'invalid_document_date_role';end if;
   elsif k not in ('summary','topic') then raise exception 'invalid_selection';end if;
  end if;
  update public.metadata_suggestions set status=case when x->>'action'='accept' then 'accepted' else 'rejected' end,reviewed_value=x,reviewed_by=auth.uid(),reviewed_at=now() where id=s.id;
  insert into public.provenance(archive_id,item_id,actor_id,field_path,value,evidence_status)
  values(r.archive_id,r.item_id,auth.uid(),'document_suggestion_review',jsonb_build_object('suggestion_id',s.id,'run_id',r.id,'original',s.suggested_value,'decision',x),'family_reported');
 end loop;
end $$;
revoke all on function public.apply_document_suggestions(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.apply_document_suggestions(uuid,jsonb,jsonb) to authenticated;
commit;
