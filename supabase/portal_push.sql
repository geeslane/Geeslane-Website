-- PWA Web Push subscriptions. Run in Supabase → SQL Editor.
-- Private VAPID key stays in Edge Function secrets, not in this file.

create table if not exists public.portal_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  audience text not null default 'client' check (audience in ('client', 'team')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists portal_push_subscriptions_user_idx
  on public.portal_push_subscriptions (user_id);
create index if not exists portal_push_subscriptions_audience_idx
  on public.portal_push_subscriptions (audience);

alter table public.portal_push_subscriptions enable row level security;

drop policy if exists portal_push_own on public.portal_push_subscriptions;
create policy portal_push_own on public.portal_push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.portal_push_subscriptions from anon, authenticated;
grant select, insert, update, delete on public.portal_push_subscriptions to authenticated;

create or replace function public.save_my_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_audience text default 'client'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_audience text;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if trim(coalesce(p_endpoint, '')) = '' or trim(coalesce(p_p256dh, '')) = '' or trim(coalesce(p_auth, '')) = '' then
    raise exception 'Invalid push subscription';
  end if;
  v_audience := case when p_audience = 'team' then 'team' else 'client' end;
  insert into public.portal_push_subscriptions (user_id, endpoint, p256dh, auth, audience, updated_at)
  values (auth.uid(), trim(p_endpoint), trim(p_p256dh), trim(p_auth), v_audience, now())
  on conflict (endpoint) do update set
    user_id = auth.uid(),
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    audience = excluded.audience,
    updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.save_my_push_subscription(text, text, text, text) from public;
grant execute on function public.save_my_push_subscription(text, text, text, text) to authenticated;

create or replace function public.admin_list_push_devices()
returns table(user_id uuid, audience text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  ) then
    raise exception 'Administrator access is required';
  end if;
  return query
    select s.user_id, s.audience, max(s.updated_at) as updated_at
    from public.portal_push_subscriptions s
    group by s.user_id, s.audience;
end;
$$;

revoke execute on function public.admin_list_push_devices() from public;
grant execute on function public.admin_list_push_devices() to authenticated;
