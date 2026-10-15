-- Admin project and client delete. Run in Supabase → SQL Editor before using Delete in the admin portal.
-- Child rows (invoices, receipts, files metadata, requests, milestones) follow ON DELETE CASCADE.

create or replace function public.admin_delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found';
  end if;
  delete from public.projects where id = p_project_id;
end;
$$;

revoke execute on function public.admin_delete_project(uuid) from public;
grant execute on function public.admin_delete_project(uuid) to authenticated;

create or replace function public.admin_delete_client(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_client_id uuid;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if p_user_id is null then raise exception 'Client not found'; end if;
  if p_user_id = auth.uid() then raise exception 'You cannot delete your own account'; end if;

  select * into v_profile from public.profiles where user_id = p_user_id;
  if not found then raise exception 'Client not found'; end if;
  if lower(coalesce(v_profile.role, '')) = 'admin' then
    raise exception 'Administrator accounts cannot be deleted here';
  end if;

  v_client_id := v_profile.client_id;

  if v_client_id is not null then
    delete from public.projects where client_id = v_client_id;
    update public.profiles set client_id = null where client_id = v_client_id;
    delete from public.clients where id = v_client_id;
  end if;

  if to_regclass('public.portal_push_subscriptions') is not null then
    delete from public.portal_push_subscriptions where user_id = p_user_id;
  end if;

  if coalesce(v_profile.email, '') <> '' and to_regclass('public.registrations') is not null then
    delete from public.registrations where lower(email) = lower(v_profile.email);
  end if;

  delete from public.profiles where user_id = p_user_id;

  begin
    delete from auth.users where id = p_user_id;
  exception when others then
    null;
  end;
end;
$$;

revoke execute on function public.admin_delete_client(uuid) from public;
grant execute on function public.admin_delete_client(uuid) to authenticated;
