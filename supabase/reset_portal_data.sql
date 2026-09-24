-- OPTIONAL. Do not run this until you want a clean test workspace.
-- Paste into Supabase → SQL Editor only when you are ready.
-- This file does nothing by sitting in the repo.
--
-- Keeps:
--   - administrator profiles (role = 'admin')
--   - portal_settings (bank details, payment flags)
--
-- Removes portal test data: projects, invoices, receipts, clients, registrations,
-- requests, files metadata, device subscriptions, and non-admin profiles.
--
-- After this SQL:
--   1. Confirm the leftover counts at the bottom are 0
--   2. Storage → Buckets → project-files → delete leftover objects
--   3. Authentication → Users → remove test client users only (keep your admin user)
--      Leftover Auth users do not block create-client, but you should still delete them.

begin;

-- Unlink first. profiles.client_id points at clients, so deleting clients
-- before this step rolls the whole wipe back and the old email still exists.
update public.profiles set client_id = null where client_id is not null;

do $$
begin
  if to_regclass('public.portal_push_subscriptions') is not null then
    delete from public.portal_push_subscriptions
    where user_id not in (
      select user_id from public.profiles
      where lower(coalesce(role, '')) = 'admin' and user_id is not null
      union
      select id from public.profiles
      where lower(coalesce(role, '')) = 'admin'
    );
  end if;
end $$;

do $$
declare
  tables text[] := array[
    'milestone_messages',
    'activity',
    'portal_requests',
    'project_receipts',
    'project_invoices',
    'project_agreements',
    'assets',
    'milestones',
    'brand_kits',
    'project_content',
    'projects',
    'registrations',
    'clients'
  ];
  t text;
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
    end if;
  end loop;
end $$;

delete from public.profiles
where lower(coalesce(role, '')) is distinct from 'admin';

commit;

select 'clients'::text as item, count(*)::int as leftover from public.clients
union all
select 'projects', count(*)::int from public.projects
union all
select 'registrations', count(*)::int from public.registrations
union all
select 'profiles_non_admin', count(*)::int from public.profiles
where lower(coalesce(role, '')) is distinct from 'admin';
