-- Milestone conversations + Discovery starts in progress (not complete).
-- Run this entire file in Supabase → SQL Editor, then run milestone_review_statuses.sql.

create table if not exists public.milestone_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  author_role text not null check (author_role in ('client', 'admin')),
  author_name text not null default '',
  body text not null,
  kind text not null default 'comment' check (kind in ('comment', 'question', 'approval', 'changes')),
  created_at timestamptz not null default now()
);
create index if not exists milestone_messages_milestone_idx
  on public.milestone_messages (milestone_id, created_at);

alter table public.milestone_messages enable row level security;

drop policy if exists milestone_messages_read on public.milestone_messages;
create policy milestone_messages_read on public.milestone_messages
  for select to authenticated
  using (public.can_access_project(project_id));

revoke all on public.milestone_messages from anon, authenticated;
grant select on public.milestone_messages to authenticated;

create or replace function public.add_milestone_message(
  p_milestone_id uuid,
  p_body text,
  p_kind text default 'comment'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_milestone public.milestones%rowtype;
  v_profile public.profiles%rowtype;
  v_kind text;
  v_body text;
  v_role text;
  v_id uuid;
  v_request_id uuid;
  v_status text;
begin
  v_kind := coalesce(nullif(trim(p_kind), ''), 'comment');
  if v_kind not in ('comment', 'question', 'approval', 'changes') then
    raise exception 'Invalid message type';
  end if;
  v_body := trim(coalesce(p_body, ''));
  if v_kind = 'approval' and v_body = '' then v_body := 'Approved this stage.'; end if;
  if length(v_body) < 2 then raise exception 'Write a short note before sending.'; end if;
  if length(v_body) > 4000 then raise exception 'That note is too long.'; end if;

  select * into v_milestone from public.milestones where id = p_milestone_id;
  if v_milestone.id is null or not public.can_access_project(v_milestone.project_id) then
    raise exception 'Milestone not found';
  end if;

  select * into v_profile from public.profiles where user_id = auth.uid();
  if v_profile.user_id is null or v_profile.status <> 'active' then
    raise exception 'Active portal access is required';
  end if;

  v_role := case when v_profile.role = 'admin' then 'admin' else 'client' end;
  if v_role = 'client' and v_kind = 'question' then v_kind := 'comment'; end if;
  if v_role = 'admin' and v_kind in ('approval', 'changes') then v_kind := 'comment'; end if;

  insert into public.milestone_messages (project_id, milestone_id, author_role, author_name, body, kind)
  values (v_milestone.project_id, v_milestone.id, v_role, coalesce(nullif(v_profile.name, ''), v_profile.email), v_body, v_kind)
  returning id into v_id;

  v_status := v_milestone.status;
  if v_role = 'client' and v_milestone.status = 'review' then
    update public.milestones set status = 'admin_review', updated_at = now() where id = v_milestone.id;
    perform public.recalculate_portal_project(v_milestone.project_id);
    v_status := 'admin_review';
  end if;

  if v_role = 'client' and v_kind in ('approval', 'changes') then
    insert into public.portal_requests (project_id, reference, type, title, payload)
    values (
      v_milestone.project_id,
      'GL-M-' || substr(replace(v_id::text, '-', ''), 1, 10),
      'milestone',
      v_milestone.title || ' review',
      jsonb_build_object(
        'milestone', v_milestone.title,
        'decision', case when v_kind = 'approval' then 'Approved' else 'Changes requested' end,
        'feedback', v_body
      )
    )
    returning id into v_request_id;
    insert into public.activity (project_id, title, detail, type)
    values (
      v_milestone.project_id,
      case when v_kind = 'approval' then v_milestone.title || ' approved' else v_milestone.title || ' changes requested' end,
      v_body, 'milestone'
    );
  else
    insert into public.activity (project_id, title, detail, type)
    values (
      v_milestone.project_id,
      v_milestone.title || ' note',
      left(v_body, 140),
      'milestone'
    );
  end if;

  return jsonb_build_object(
    'id', v_id,
    'projectId', v_milestone.project_id,
    'milestoneId', v_milestone.id,
    'role', v_role,
    'name', coalesce(nullif(v_profile.name, ''), v_profile.email),
    'body', v_body,
    'kind', v_kind,
    'createdAt', now(),
    'requestId', v_request_id,
    'milestoneStatus', v_status
  );
end;
$$;

revoke execute on function public.add_milestone_message(uuid, text, text) from public;
grant execute on function public.add_milestone_message(uuid, text, text) to authenticated;

create or replace function public.seed_portal_project(
  p_client_id uuid, p_name text, p_service text, p_target_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_project_id uuid;
begin
  insert into public.projects (client_id, name, service, target_date)
  values (p_client_id, trim(p_name), coalesce(nullif(trim(p_service), ''), 'Website project'), p_target_date)
  returning id into v_project_id;
  insert into public.brand_kits (project_id) values (v_project_id);
  insert into public.project_content (project_id) values (v_project_id);
  insert into public.milestones (project_id, code, title, description, weight, status, sort_order) values
    (v_project_id, 'M1', 'Discovery', 'Goals, audience, scope, and project requirements.', 10, 'current', 1),
    (v_project_id, 'M2', 'Brand assets & content', 'Logos, colours, photography, copy, and source material.', 15, 'upcoming', 2),
    (v_project_id, 'M3', 'Wireframe', 'Page structure, information flow, and experience plan.', 15, 'upcoming', 3),
    (v_project_id, 'M4', 'Visual design', 'Layout, styling, and responsive design review.', 20, 'upcoming', 4),
    (v_project_id, 'M5', 'Development', 'Build, interactions, integrations, and quality checks.', 25, 'upcoming', 5),
    (v_project_id, 'M6', 'QA & Testing', 'Quality checks, staging tests, and approval before launch.', 10, 'upcoming', 6),
    (v_project_id, 'M7', 'Launch & handover', 'Release, documentation, and project handover.', 5, 'upcoming', 7);
  perform public.recalculate_portal_project(v_project_id);
  insert into public.activity (project_id, title, detail, type)
  values (v_project_id, 'Project workspace created', trim(p_name), 'request');
  return v_project_id;
end;
$$;

-- Reopen Discovery only when later stages were never started (old auto-complete).
update public.milestones m
set status = 'current'
where coalesce(m.code, '') = 'M1'
  and m.status = 'complete'
  and not exists (
    select 1 from public.milestones x
    where x.project_id = m.project_id
      and x.sort_order > 1
      and x.status is distinct from 'upcoming'
  );

do $$
declare r record;
begin
  for r in
    select distinct m.project_id
    from public.milestones m
    where coalesce(m.code, '') = 'M1'
      and m.status = 'current'
      and not exists (
        select 1 from public.milestones x
        where x.project_id = m.project_id
          and x.sort_order > 1
          and x.status is distinct from 'upcoming'
      )
  loop
    perform public.recalculate_portal_project(r.project_id);
  end loop;
end $$;
