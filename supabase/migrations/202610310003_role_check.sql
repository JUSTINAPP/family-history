begin;
create function public.can_access_archive(p_archive_id uuid,p_minimum public.archive_role default 'viewer') returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
 select archive_private.can_access(p_archive_id,p_minimum)
$$;
revoke all on function public.can_access_archive(uuid,public.archive_role) from public,anon;
grant execute on function public.can_access_archive(uuid,public.archive_role) to authenticated;
commit;
