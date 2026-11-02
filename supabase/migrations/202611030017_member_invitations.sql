begin;
create or replace function public.create_member_invitation(p_archive_id uuid, p_email text)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare token text; invitation uuid; address text:=lower(trim(p_email));
begin
 if not archive_private.can_access(p_archive_id,'contributor') then raise exception 'permission_denied'; end if;
 if length(address)>254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'invalid_email';end if;
 if (select count(*) from public.invitations where invited_by=auth.uid() and created_at>now()-interval '1 day')>=20 then raise exception 'invitation_limit';end if;
 if exists(select 1 from public.archive_memberships m join public.profiles p on p.id=m.profile_id where m.archive_id=p_archive_id and lower(p.email)=address) then raise exception 'already_member';end if;
 update public.invitations set status='revoked',updated_at=now() where archive_id=p_archive_id and lower(email)=address and status='invited';
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.invitations(archive_id,name,email,role,invited_by,expires_at) values(p_archive_id,address,address,'contributor',auth.uid(),now()+interval '7 days') returning id into invitation;
 insert into archive_private.invitation_tokens(invitation_id,token_hash) values(invitation,encode(sha256(convert_to(token,'UTF8')),'hex'));
 return token;
end $$;
create or replace function public.read_member_invitation(p_token text)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('email',i.email,'archiveName',a.name) from public.invitations i
 join archive_private.invitation_tokens t on t.invitation_id=i.id join public.archives a on a.id=i.archive_id
 join public.archive_memberships m on m.archive_id=i.archive_id and m.profile_id=i.invited_by
 where length(p_token)=64 and t.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and i.status='invited' and i.expires_at>now()
 and m.status='active' and archive_private.role_rank(m.role)>=3 and a.privacy='members_only'
$$;
create or replace function public.accept_member_invitation(p_token text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare invitation public.invitations; address text; membership public.archive_memberships;
begin
 if auth.uid() is null or length(p_token)<>64 then raise exception 'invalid_invitation';end if;
 select i.* into invitation from public.invitations i join archive_private.invitation_tokens t on t.invitation_id=i.id where t.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update of i;
 if not found then raise exception 'invalid_invitation';end if;
 if invitation.status='accepted' and invitation.accepted_by=auth.uid() then return invitation.archive_id;end if;
 if public.read_member_invitation(p_token) is null then raise exception 'invalid_invitation';end if;
 select lower(email) into address from auth.users where id=auth.uid();
 if address is distinct from lower(invitation.email) then raise exception 'wrong_account';end if;
 select * into membership from public.archive_memberships where archive_id=invitation.archive_id and profile_id=auth.uid() for update;
 if found and membership.status<>'active' then raise exception 'membership_blocked';end if;
 insert into public.archive_memberships(archive_id,profile_id,role,status) values(invitation.archive_id,auth.uid(),'contributor','active') on conflict(archive_id,profile_id) do nothing;
 update public.invitations set status='accepted',accepted_by=auth.uid(),updated_at=now() where id=invitation.id;
 return invitation.archive_id;
end $$;
revoke all on function public.create_member_invitation(uuid,text),public.read_member_invitation(text),public.accept_member_invitation(text) from public,anon,authenticated;
grant execute on function public.create_member_invitation(uuid,text),public.accept_member_invitation(text) to authenticated;
grant execute on function public.read_member_invitation(text) to anon,authenticated;
commit;
