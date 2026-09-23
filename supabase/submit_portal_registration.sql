-- Block access requests from emails that already have a portal account.
-- Run this in Supabase → SQL Editor.

create or replace function public.submit_portal_registration(
  p_name text,
  p_business text,
  p_email text,
  p_phone text,
  p_contact text,
  p_service text,
  p_description text,
  p_target_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(trim(coalesce(p_name, ''))) < 2
     or length(trim(coalesce(p_business, ''))) < 2
     or position('@' in coalesce(p_email, '')) < 2
     or length(trim(coalesce(p_service, ''))) < 2
     or length(trim(coalesce(p_description, ''))) < 5 then
    raise exception 'Please complete the required access-request fields';
  end if;

  if exists (select 1 from public.clients where lower(email) = lower(trim(p_email)))
     or exists (select 1 from public.profiles where lower(email) = lower(trim(p_email))) then
    raise exception 'This email already has a Geeslane portal account. Sign in instead.';
  end if;

  select id into v_id from public.registrations
  where lower(email) = lower(trim(p_email)) and status = 'Pending'
  order by created_at desc limit 1;

  if v_id is null then
    insert into public.registrations (
      email, name, business, phone, contact_preference, requested_service, project_description, target_date
    ) values (
      lower(trim(p_email)), trim(p_name), trim(p_business), trim(coalesce(p_phone, '')),
      coalesce(nullif(trim(p_contact), ''), 'Email'), trim(p_service), trim(p_description), p_target_date
    ) returning id into v_id;
  else
    update public.registrations set
      name = trim(p_name), business = trim(p_business), phone = trim(coalesce(p_phone, '')),
      contact_preference = coalesce(nullif(trim(p_contact), ''), 'Email'),
      requested_service = trim(p_service), project_description = trim(p_description),
      target_date = p_target_date, updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;
