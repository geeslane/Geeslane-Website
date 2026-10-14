-- Admin project delete. Run in Supabase → SQL Editor before using Delete in the admin portal.
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
