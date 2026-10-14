-- Handover packs and the public/client help centre.
-- Run in Supabase → SQL Editor.

create table if not exists public.project_handovers (
  project_id uuid primary key references public.projects(id) on delete cascade,
  track text not null default 'website',
  sections jsonb not null default '{}'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  notes text not null default '',
  file_drive_url text not null default '',
  file_retention_days integer not null default 30,
  status text not null default 'draft' check (status in ('draft', 'ready', 'sent')),
  sent_at timestamptz,
  sent_to text not null default '',
  storage_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_handovers enable row level security;

drop policy if exists project_handovers_read on public.project_handovers;
create policy project_handovers_read on public.project_handovers
  for select to authenticated
  using (public.can_access_project(project_id));

revoke all on public.project_handovers from anon, authenticated;
grant select on public.project_handovers to authenticated;

create or replace function public.save_project_handover(
  p_project_id uuid,
  p_handover jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.project_handovers%rowtype;
  v_days integer;
  v_status text;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found';
  end if;

  v_days := coalesce((p_handover->>'fileRetentionDays')::integer, 30);
  if v_days < 30 then v_days := 30; end if;
  if v_days > 60 then v_days := 60; end if;
  v_status := coalesce(nullif(trim(p_handover->>'status'), ''), 'draft');
  if v_status not in ('draft', 'ready', 'sent') then v_status := 'draft'; end if;

  insert into public.project_handovers (
    project_id, track, sections, checklist, notes, file_drive_url, file_retention_days,
    status, sent_at, sent_to, storage_path, updated_at
  ) values (
    p_project_id,
    coalesce(nullif(trim(p_handover->>'track'), ''), 'website'),
    coalesce(p_handover->'sections', '{}'::jsonb),
    coalesce(p_handover->'checklist', '[]'::jsonb),
    trim(coalesce(p_handover->>'notes', '')),
    trim(coalesce(p_handover->>'fileDriveUrl', '')),
    v_days,
    v_status,
    case when v_status = 'sent' then coalesce((p_handover->>'sentAt')::timestamptz, now()) else null end,
    trim(coalesce(p_handover->>'sentTo', '')),
    trim(coalesce(p_handover->>'storagePath', '')),
    now()
  )
  on conflict (project_id) do update set
    track = excluded.track,
    sections = excluded.sections,
    checklist = excluded.checklist,
    notes = excluded.notes,
    file_drive_url = excluded.file_drive_url,
    file_retention_days = excluded.file_retention_days,
    status = excluded.status,
    sent_at = case when excluded.status = 'sent' then coalesce(excluded.sent_at, public.project_handovers.sent_at, now()) else public.project_handovers.sent_at end,
    sent_to = case when excluded.sent_to <> '' then excluded.sent_to else public.project_handovers.sent_to end,
    storage_path = case when excluded.storage_path <> '' then excluded.storage_path else public.project_handovers.storage_path end,
    updated_at = now()
  returning * into v_row;

  insert into public.activity (project_id, title, detail, type)
  values (p_project_id, 'Handover pack updated', 'Project handover details were saved.', 'request');

  return jsonb_build_object(
    'projectId', v_row.project_id,
    'track', v_row.track,
    'sections', v_row.sections,
    'checklist', v_row.checklist,
    'notes', v_row.notes,
    'fileDriveUrl', v_row.file_drive_url,
    'fileRetentionDays', v_row.file_retention_days,
    'status', v_row.status,
    'sentAt', v_row.sent_at,
    'sentTo', v_row.sent_to,
    'storagePath', v_row.storage_path,
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke execute on function public.save_project_handover(uuid, jsonb) from public;
grant execute on function public.save_project_handover(uuid, jsonb) to authenticated;

create table if not exists public.help_guides (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null default 'website',
  title text not null,
  body text not null,
  audience text not null default 'both' check (audience in ('public', 'client', 'both')),
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.help_guides enable row level security;

drop policy if exists help_guides_public_read on public.help_guides;
create policy help_guides_public_read on public.help_guides
  for select to anon, authenticated
  using (published = true and audience in ('public', 'both'));

drop policy if exists help_guides_client_read on public.help_guides;
create policy help_guides_client_read on public.help_guides
  for select to authenticated
  using (published = true and audience in ('client', 'both'));

drop policy if exists help_guides_admin_read on public.help_guides;
create policy help_guides_admin_read on public.help_guides
  for select to authenticated
  using (public.is_portal_admin());

revoke all on public.help_guides from anon, authenticated;
grant select on public.help_guides to anon, authenticated;

create or replace function public.admin_save_help_guide(p_guide jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_row public.help_guides%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  v_id := nullif(trim(p_guide->>'id'), '')::uuid;
  if v_id is null then
    insert into public.help_guides (slug, category, title, body, audience, sort_order, published, updated_at)
    values (
      trim(coalesce(p_guide->>'slug', '')),
      coalesce(nullif(trim(p_guide->>'category'), ''), 'website'),
      trim(coalesce(p_guide->>'title', '')),
      trim(coalesce(p_guide->>'body', '')),
      coalesce(nullif(trim(p_guide->>'audience'), ''), 'both'),
      coalesce((p_guide->>'sortOrder')::integer, 0),
      coalesce((p_guide->>'published')::boolean, true),
      now()
    )
    returning * into v_row;
  else
    update public.help_guides set
      slug = trim(coalesce(p_guide->>'slug', slug)),
      category = coalesce(nullif(trim(p_guide->>'category'), ''), category),
      title = trim(coalesce(p_guide->>'title', title)),
      body = trim(coalesce(p_guide->>'body', body)),
      audience = coalesce(nullif(trim(p_guide->>'audience'), ''), audience),
      sort_order = coalesce((p_guide->>'sortOrder')::integer, sort_order),
      published = coalesce((p_guide->>'published')::boolean, published),
      updated_at = now()
    where id = v_id
    returning * into v_row;
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'slug', v_row.slug,
    'category', v_row.category,
    'title', v_row.title,
    'body', v_row.body,
    'audience', v_row.audience,
    'sortOrder', v_row.sort_order,
    'published', v_row.published
  );
end;
$$;

create or replace function public.admin_delete_help_guide(p_guide_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  delete from public.help_guides where id = p_guide_id;
end;
$$;

revoke execute on function public.admin_save_help_guide(jsonb) from public;
revoke execute on function public.admin_delete_help_guide(uuid) from public;
grant execute on function public.admin_save_help_guide(jsonb) to authenticated;
grant execute on function public.admin_delete_help_guide(uuid) to authenticated;

insert into public.help_guides (slug, category, title, body, audience, sort_order, published) values
(
  'domain-where-is-it',
  'domain',
  'Where is my domain, and how do I log in?',
  'Your handover pack lists the domain name, where it is registered, the login, and the expiry date. Use that login page (often Namecheap, GoDaddy, Truehost, or similar). If a username or password is missing, email Geeslane and we will point you to the registrar account or help you reset access.',
  'both',
  10,
  true
),
(
  'domain-renew',
  'domain',
  'How do I renew my domain?',
  'Open the registrar account in your handover pack before the expiry date. Pay the renewal there. First-year or promotional prices can change. If Geeslane still manages the account for you, email us at least two weeks before expiry so we can send the known cost for you to approve.',
  'both',
  20,
  true
),
(
  'hosting-access',
  'hosting',
  'How do I access my website files and hosting?',
  'Your handover pack says where the site is hosted, the login URL, and how to get in. That may be cPanel, a host dashboard, or a repository. Keep your own copy of the files. If we shared a drive link, we remove our copy after 30 to 60 days.',
  'both',
  30,
  true
),
(
  'email-setup',
  'email',
  'How do I use my professional email?',
  'The handover pack lists the mailbox, login, and expiry. Sign in at the webmail or app shown there (often the host, Google Workspace, or Microsoft 365). If it is still on a free trial, the pack says so and how to convert it before it lapses.',
  'both',
  40,
  true
),
(
  'email-renew-trial',
  'email',
  'What if my email is on a free trial?',
  'Pay to convert the mailbox before the trial ends, using the renewal steps in the handover pack. If it lapses, mail can stop and the address may be hard to recover. Email Geeslane if you want us to walk through the upgrade with you.',
  'both',
  50,
  true
),
(
  'website-files-copy',
  'website',
  'How do I keep a copy of my website files?',
  'Download the files from the drive or hosting login in your handover pack and store them somewhere you control. Geeslane keeps a working copy only for a short time (30 to 60 days), then we remove it from our drive. We cannot promise a later copy if yours is lost.',
  'both',
  60,
  true
),
(
  'website-login',
  'website',
  'How do I log in to edit my website?',
  'Use the administrator URL, username, and password in the handover pack. Change the password after you first sign in and keep it private. If the login fails, try a password reset on that site first, then email Geeslane if you still cannot get in.',
  'both',
  70,
  true
),
(
  'portal-where-to-start',
  'portal',
  'Where do I start in the client portal?',
  'Open Overview for the next step. Brief & Brand is where goals, brand, and files live. Agreement holds the terms. Payments shows invoices and receipts. Requests is for changes and updates.',
  'client',
  80,
  true
),
(
  'need-more-help',
  'support',
  'I still need help. How do I reach Geeslane?',
  'Email contact@geeslane.com with your business name and what is stuck (domain, hosting, email, or the website). If you have a portal, send a request there as well. We will pick it up from there. This is the escalation path: help centre first, then email Geeslane, then a portal request if the project is active.',
  'both',
  90,
  true
)
on conflict (slug) do nothing;
