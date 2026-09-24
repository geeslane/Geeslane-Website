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
declare
  v_project_id uuid;
  v_service text;
  v_track text;
begin
  v_service := coalesce(nullif(trim(p_service), ''), 'Website project');
  v_track := lower(v_service);

  insert into public.projects (client_id, name, service, target_date)
  values (p_client_id, trim(p_name), v_service, p_target_date)
  returning id into v_project_id;
  insert into public.brand_kits (project_id) values (v_project_id);
  insert into public.project_content (project_id) values (v_project_id);

  if v_track ~ 'automat|chatbot|workflow|n8n|zapier|make\.com'
     or v_track ~ '(^|[^a-z])ai([^a-z]|$)' then
    insert into public.milestones (project_id, code, title, description, weight, status, sort_order) values
      (v_project_id, 'A1', 'Discovery', 'What to automate, the tools in use, and what success looks like.', 25, 'current', 1),
      (v_project_id, 'A2', 'Build & Connect', 'Design and connect the workflow, then test it with real cases.', 50, 'upcoming', 2),
      (v_project_id, 'A3', 'Review & Handover', 'Confirm it works, then hand over access and how to use it.', 25, 'upcoming', 3);
  elsif v_track ~ 'consult|strateg|advice' then
    insert into public.milestones (project_id, code, title, description, weight, status, sort_order) values
      (v_project_id, 'C1', 'Discovery', 'The business problem and what success should look like.', 30, 'current', 1),
      (v_project_id, 'C2', 'Recommendation', 'Practical options and a recommended next step.', 45, 'upcoming', 2),
      (v_project_id, 'C3', 'Review & Next Steps', 'Agree the advice and what happens next.', 25, 'upcoming', 3);
  elsif v_track ~ '(host|domain|dns|ssl|monitor|maintenance)'
     or (v_track ~ 'support' and v_track !~ 'website|revamp|landing|portfolio') then
    insert into public.milestones (project_id, code, title, description, weight, status, sort_order) values
      (v_project_id, 'S1', 'Discovery', 'What is needed, access details, and the current setup.', 25, 'current', 1),
      (v_project_id, 'S2', 'Setup & Fix', 'Complete the setup, change, or repair.', 50, 'upcoming', 2),
      (v_project_id, 'S3', 'Review & Handover', 'Confirm it is working and hand over what you need.', 25, 'upcoming', 3);
  else
    insert into public.milestones (project_id, code, title, description, weight, status, sort_order) values
      (v_project_id, 'M1', 'Discovery', 'What the project needs, and who it is for.', 10, 'current', 1),
      (v_project_id, 'M2', 'Brand assets & content', 'Logos, colours, photos, and copy.', 15, 'upcoming', 2),
      (v_project_id, 'M3', 'Wireframe', 'How the pages are laid out.', 15, 'upcoming', 3),
      (v_project_id, 'M4', 'Visual design', 'How the site looks.', 20, 'upcoming', 4),
      (v_project_id, 'M5', 'Development', 'Building the site.', 25, 'upcoming', 5),
      (v_project_id, 'M6', 'QA & Testing', 'Final check before launch.', 10, 'upcoming', 6),
      (v_project_id, 'M7', 'Launch & handover', 'Go live and hand over.', 5, 'upcoming', 7);
  end if;

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
