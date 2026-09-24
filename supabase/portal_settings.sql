-- Brief columns (fixes: column "goal" of relation "project_content" does not exist),
-- bank transfer details for invoices, and admin client create without requiring those columns first.
-- Run in Supabase → SQL Editor after project_brief.sql / projects_invoices.sql.

alter table public.project_content
  add column if not exists goal text not null default '',
  add column if not exists audience text not null default '',
  add column if not exists scope text not null default '';

create table if not exists public.portal_settings (
  id integer primary key default 1 check (id = 1),
  bank_name text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  bank_notes text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.portal_settings (id) values (1)
on conflict (id) do nothing;

alter table public.portal_settings enable row level security;

drop policy if exists portal_settings_read on public.portal_settings;
create policy portal_settings_read on public.portal_settings
  for select to authenticated
  using (true);

revoke all on public.portal_settings from anon, authenticated;
grant select on public.portal_settings to authenticated;

create or replace function public.admin_save_portal_settings(p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.portal_settings%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  insert into public.portal_settings (id, bank_name, account_name, account_number, bank_notes, updated_at)
  values (
    1,
    coalesce(trim(p_settings->>'bankName'), ''),
    coalesce(trim(p_settings->>'accountName'), ''),
    coalesce(trim(p_settings->>'accountNumber'), ''),
    coalesce(trim(p_settings->>'bankNotes'), ''),
    now()
  )
  on conflict (id) do update set
    bank_name = excluded.bank_name,
    account_name = excluded.account_name,
    account_number = excluded.account_number,
    bank_notes = excluded.bank_notes,
    updated_at = now()
  returning * into v_row;
  return jsonb_build_object(
    'bankName', v_row.bank_name,
    'accountName', v_row.account_name,
    'accountNumber', v_row.account_number,
    'bankNotes', v_row.bank_notes
  );
end;
$$;

revoke execute on function public.admin_save_portal_settings(jsonb) from public;
grant execute on function public.admin_save_portal_settings(jsonb) to authenticated;

create or replace function public.admin_create_client_project(
  p_name text,
  p_business text,
  p_email text,
  p_phone text default '',
  p_contact text default 'Email',
  p_project_name text default '',
  p_service text default 'Website project',
  p_target_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id uuid;
  v_project_id uuid;
  v_email text := lower(trim(p_email));
  v_contact text := coalesce(nullif(trim(p_contact), ''), 'Email');
  v_result jsonb;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_business, ''))) < 2 or position('@' in coalesce(p_email, '')) < 2 then
    raise exception 'Enter the client name, business, and email';
  end if;
  if length(trim(coalesce(p_project_name, ''))) < 2 then raise exception 'Enter a project name'; end if;
  if exists (select 1 from public.clients where lower(email) = v_email) then
    raise exception 'A client with this email already exists';
  end if;

  insert into public.clients (name, business, email, phone, contact_preference)
  values (trim(p_name), trim(p_business), v_email, trim(coalesce(p_phone, '')), v_contact)
  returning id into v_client_id;
  v_project_id := public.seed_portal_project(
    v_client_id,
    trim(p_project_name),
    coalesce(nullif(trim(p_service), ''), 'Website project'),
    p_target_date
  );
  update public.profiles set
    client_id = v_client_id,
    status = 'active',
    name = trim(p_name),
    business = trim(p_business),
    phone = trim(coalesce(p_phone, '')),
    contact_preference = v_contact,
    updated_at = now()
  where lower(email) = v_email;

  select jsonb_build_object(
    'email', v_email,
    'profileData', jsonb_build_object(
      'name', trim(p_name), 'business', trim(p_business),
      'phone', trim(coalesce(p_phone, '')), 'contact', v_contact
    ),
    'project', jsonb_build_object(
      'id', p.id, 'clientId', p.client_id, 'name', p.name, 'service', p.service,
      'status', p.status, 'stage', p.stage, 'progress', p.progress, 'targetDate', p.target_date
    )
  ) into v_result from public.projects p where p.id = v_project_id;
  return v_result;
end;
$$;

revoke execute on function public.admin_create_client_project(text, text, text, text, text, text, text, date) from public;
grant execute on function public.admin_create_client_project(text, text, text, text, text, text, text, date) to authenticated;
