-- Website Project Agreement per project.
-- Run in Supabase → SQL Editor after the base portal schema.

create table if not exists public.project_agreements (
  project_id uuid primary key references public.projects(id) on delete cascade,
  client_name text not null default '',
  project_title text not null default '',
  deliverables text not null default '',
  fee text not null default '',
  payment_plan text not null default '',
  revision_rounds integer not null default 5,
  timeline text not null default '',
  handover jsonb not null default '{}'::jsonb,
  saved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint project_agreements_revision_rounds_check check (revision_rounds between 0 and 5)
);

alter table public.project_agreements enable row level security;

drop policy if exists project_agreements_read on public.project_agreements;
create policy project_agreements_read on public.project_agreements
  for select to authenticated
  using (public.can_access_project(project_id));

revoke all on public.project_agreements from anon, authenticated;
grant select on public.project_agreements to authenticated;

create or replace function public.save_project_agreement(
  p_project_id uuid,
  p_agreement jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rounds integer;
  v_handover jsonb;
  v_row public.project_agreements%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found';
  end if;

  v_rounds := coalesce((p_agreement->>'revisionRounds')::integer, 0);
  if v_rounds < 0 then v_rounds := 0; end if;
  if v_rounds > 5 then v_rounds := 5; end if;
  v_handover := coalesce(p_agreement->'handover', '{}'::jsonb);

  insert into public.project_agreements (
    project_id, client_name, project_title, deliverables, fee, payment_plan,
    revision_rounds, timeline, handover, saved_at, updated_at
  ) values (
    p_project_id,
    trim(coalesce(p_agreement->>'clientName', '')),
    trim(coalesce(p_agreement->>'projectTitle', '')),
    trim(coalesce(p_agreement->>'deliverables', '')),
    trim(coalesce(p_agreement->>'fee', '')),
    trim(coalesce(p_agreement->>'paymentPlan', '')),
    v_rounds,
    trim(coalesce(p_agreement->>'timeline', '')),
    v_handover,
    now(),
    now()
  )
  on conflict (project_id) do update set
    client_name = excluded.client_name,
    project_title = excluded.project_title,
    deliverables = excluded.deliverables,
    fee = excluded.fee,
    payment_plan = excluded.payment_plan,
    revision_rounds = excluded.revision_rounds,
    timeline = excluded.timeline,
    handover = excluded.handover,
    saved_at = now(),
    updated_at = now()
  returning * into v_row;

  insert into public.activity (project_id, title, detail, type)
  values (p_project_id, 'Project agreement updated', 'The website project agreement details were updated.', 'request');

  return jsonb_build_object(
    'projectId', v_row.project_id,
    'clientName', v_row.client_name,
    'projectTitle', v_row.project_title,
    'deliverables', v_row.deliverables,
    'fee', v_row.fee,
    'paymentPlan', v_row.payment_plan,
    'revisionRounds', v_row.revision_rounds,
    'timeline', v_row.timeline,
    'handover', v_row.handover,
    'savedAt', v_row.saved_at,
    'updatedAt', v_row.updated_at
  );
end;
$$;

revoke execute on function public.save_project_agreement(uuid, jsonb) from public;
grant execute on function public.save_project_agreement(uuid, jsonb) to authenticated;
