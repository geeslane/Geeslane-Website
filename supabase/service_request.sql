-- Public service-request form + portal prefill.
-- Run in Supabase → SQL Editor after project_brief.sql.

alter table public.registrations
  add column if not exists discovery jsonb not null default '{}'::jsonb;

alter table public.project_content
  add column if not exists goal text not null default '',
  add column if not exists audience text not null default '',
  add column if not exists scope text not null default '',
  add column if not exists discovery jsonb not null default '{}'::jsonb;

create or replace function public.discovery_text(p_discovery jsonb, p_key text)
returns text
language sql
immutable
as $$
  select case
    when p_discovery is null then ''
    when jsonb_typeof(p_discovery -> p_key) = 'array' then coalesce((
      select string_agg(value, ', ')
      from jsonb_array_elements_text(p_discovery -> p_key)
    ), '')
    else coalesce(p_discovery ->> p_key, '')
  end;
$$;

create or replace function public.apply_project_discovery(p_project_id uuid, p_discovery jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d jsonb := coalesce(p_discovery, '{}'::jsonb);
  v_goal text;
  v_audience text;
  v_scope text;
  v_about text;
  v_references text;
begin
  v_goal := nullif(trim(concat_ws(E'\n\n',
    nullif(public.discovery_text(v_d, 'purpose'), ''),
    nullif(public.discovery_text(v_d, 'automationNeed'), ''),
    nullif(public.discovery_text(v_d, 'changesWanted'), ''),
    nullif(public.discovery_text(v_d, 'issue'), ''),
    nullif(public.discovery_text(v_d, 'businessProblem'), '')
  )), '');
  v_audience := nullif(trim(concat_ws(E'\n\n',
    nullif(public.discovery_text(v_d, 'audience'), ''),
    nullif(public.discovery_text(v_d, 'digitalChannels'), '')
  )), '');
  v_scope := nullif(trim(concat_ws(E'\n\n',
    nullif(public.discovery_text(v_d, 'visitorDetails'), ''),
    nullif(public.discovery_text(v_d, 'visitorsCanDo'), ''),
    nullif(public.discovery_text(v_d, 'featuresOther'), ''),
    nullif(public.discovery_text(v_d, 'improvementTypes'), ''),
    nullif(public.discovery_text(v_d, 'hostingHelp'), ''),
    nullif(public.discovery_text(v_d, 'supportNeeds'), ''),
    nullif(public.discovery_text(v_d, 'automationSuccess'), ''),
    nullif(public.discovery_text(v_d, 'successLookLike'), '')
  )), '');
  v_about := nullif(public.discovery_text(v_d, 'businessDescription'), '');
  v_references := nullif(public.discovery_text(v_d, 'references'), '');

  insert into public.project_content (
    project_id, goal, audience, scope, introduction, about, extra_notes, discovery, updated_at
  ) values (
    p_project_id,
    coalesce(v_goal, ''),
    coalesce(v_audience, ''),
    coalesce(v_scope, ''),
    coalesce(v_about, ''),
    coalesce(v_about, ''),
    coalesce(nullif(public.discovery_text(v_d, 'anythingElse'), ''), ''),
    v_d,
    now()
  )
  on conflict (project_id) do update set
    goal = case when excluded.goal <> '' then excluded.goal else project_content.goal end,
    audience = case when excluded.audience <> '' then excluded.audience else project_content.audience end,
    scope = case when excluded.scope <> '' then excluded.scope else project_content.scope end,
    introduction = case when excluded.introduction <> '' then excluded.introduction else project_content.introduction end,
    about = case when excluded.about <> '' then excluded.about else project_content.about end,
    extra_notes = case when excluded.extra_notes <> '' then excluded.extra_notes else project_content.extra_notes end,
    discovery = project_content.discovery || excluded.discovery,
    updated_at = now();

  if v_references is not null then
    update public.brand_kits
    set reference_links = case
      when coalesce(nullif(trim(reference_links), ''), '') = '' then v_references
      else reference_links
    end
    where project_id = p_project_id;
  end if;
end;
$$;

drop function if exists public.submit_portal_registration(text, text, text, text, text, text, text, date);

create or replace function public.submit_portal_registration(
  p_name text,
  p_business text,
  p_email text,
  p_phone text,
  p_contact text,
  p_service text,
  p_description text,
  p_target_date date default null,
  p_discovery jsonb default '{}'::jsonb
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
    raise exception 'Please complete the required request fields';
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
      email, name, business, phone, contact_preference, requested_service, project_description, target_date, discovery
    ) values (
      lower(trim(p_email)), trim(p_name), trim(p_business), trim(coalesce(p_phone, '')),
      coalesce(nullif(trim(p_contact), ''), 'Email'), trim(p_service), trim(p_description), p_target_date,
      coalesce(p_discovery, '{}'::jsonb)
    ) returning id into v_id;
  else
    update public.registrations set
      name = trim(p_name), business = trim(p_business), phone = trim(coalesce(p_phone, '')),
      contact_preference = coalesce(nullif(trim(p_contact), ''), 'Email'),
      requested_service = trim(p_service), project_description = trim(p_description),
      target_date = p_target_date, discovery = coalesce(p_discovery, '{}'::jsonb), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_approve_registration(
  p_registration_id uuid, p_project_name text, p_service text,
  p_target_date date default null, p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_client_id uuid;
  v_project_id uuid;
  v_result jsonb;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  select * into v_registration from public.registrations where id = p_registration_id for update;
  if v_registration.id is null or v_registration.status <> 'Pending' then raise exception 'Pending registration not found'; end if;
  if exists (select 1 from public.clients where lower(email) = lower(v_registration.email)) then raise exception 'A client with this email already exists'; end if;

  insert into public.clients (name, business, email, phone, contact_preference)
  values (v_registration.name, v_registration.business, lower(v_registration.email), v_registration.phone, v_registration.contact_preference)
  returning id into v_client_id;
  v_project_id := public.seed_portal_project(v_client_id, p_project_name, p_service, coalesce(p_target_date, v_registration.target_date));
  begin
    perform public.apply_project_discovery(v_project_id, v_registration.discovery);
  exception when undefined_function or undefined_column then
    null;
  end;
  update public.registrations set status = 'Approved', admin_notes = coalesce(p_notes, ''), updated_at = now(), reviewed_at = now()
  where id = p_registration_id;
  update public.profiles set client_id = v_client_id, status = 'active', name = v_registration.name,
    business = v_registration.business, phone = v_registration.phone,
    contact_preference = v_registration.contact_preference, updated_at = now()
  where lower(email) = lower(v_registration.email);

  select jsonb_build_object(
    'registrationId', p_registration_id, 'status', 'Approved', 'email', lower(v_registration.email),
    'profileData', jsonb_build_object('name', v_registration.name, 'business', v_registration.business, 'phone', v_registration.phone, 'contact', v_registration.contact_preference),
    'project', jsonb_build_object('id', p.id, 'clientId', p.client_id, 'name', p.name, 'service', p.service, 'status', p.status, 'stage', p.stage, 'progress', p.progress, 'targetDate', p.target_date, 'updatedAt', p.updated_at),
    'milestones', (select coalesce(jsonb_agg(jsonb_build_object('projectId', m.project_id, 'id', m.id, 'title', m.title, 'weight', m.weight, 'status', m.status, 'sortOrder', m.sort_order) order by m.sort_order), '[]'::jsonb) from public.milestones m where m.project_id = v_project_id)
  ) into v_result from public.projects p where p.id = v_project_id;
  return v_result;
end;
$$;

create or replace function public.save_project_brief(
  p_project_id uuid, p_brief jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discovery jsonb;
begin
  if not public.can_access_project(p_project_id) then raise exception 'Project access denied'; end if;
  v_discovery := coalesce(p_brief, '{}'::jsonb);
  insert into public.project_content (project_id, goal, audience, scope, discovery, updated_at)
  values (
    p_project_id,
    coalesce(p_brief->>'goal', ''),
    coalesce(p_brief->>'audience', ''),
    coalesce(p_brief->>'scope', ''),
    v_discovery,
    now()
  ) on conflict (project_id) do update set
    goal = excluded.goal,
    audience = excluded.audience,
    scope = excluded.scope,
    discovery = project_content.discovery || excluded.discovery,
    updated_at = now();
  insert into public.portal_requests (project_id, reference, type, title, payload)
  values (p_project_id, 'PROJECT-BRIEF', 'discovery', 'Project brief', coalesce(p_brief, '{}'::jsonb))
  on conflict (project_id, reference) do update set
    payload = excluded.payload, title = excluded.title, updated_at = now();
  insert into public.activity (project_id, title, detail, type)
  values (p_project_id, 'Project brief updated', 'Goals, audience, and first-version notes changed.', 'request');
end;
$$;

revoke execute on function public.discovery_text(jsonb, text) from public;
revoke execute on function public.apply_project_discovery(uuid, jsonb) from public;
revoke execute on function public.submit_portal_registration(text, text, text, text, text, text, text, date, jsonb) from public;
revoke execute on function public.admin_approve_registration(uuid, text, text, date, text) from public;
revoke execute on function public.save_project_brief(uuid, jsonb) from public;

grant execute on function public.submit_portal_registration(text, text, text, text, text, text, text, date, jsonb) to anon, authenticated;
grant execute on function public.admin_approve_registration(uuid, text, text, date, text) to authenticated;
grant execute on function public.save_project_brief(uuid, jsonb) to authenticated;
grant execute on function public.apply_project_discovery(uuid, jsonb) to authenticated;
