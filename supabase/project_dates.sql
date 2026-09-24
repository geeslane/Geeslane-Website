-- Start date on projects, and revision rounds only where they apply (0 allowed).
-- Run in Supabase → SQL Editor.

alter table public.projects
  add column if not exists start_date date;

alter table public.project_agreements
  drop constraint if exists project_agreements_revision_rounds_check;

alter table public.project_agreements
  add constraint project_agreements_revision_rounds_check check (revision_rounds between 0 and 5);

drop function if exists public.update_my_project(uuid, text, text, date);
drop function if exists public.update_my_project(uuid, text, text, date, date);

create function public.update_my_project(
  p_project_id uuid,
  p_name text,
  p_service text,
  p_target_date date default null,
  p_start_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_project(p_project_id) then raise exception 'Project access denied'; end if;
  update public.projects set
    name = coalesce(nullif(trim(p_name), ''), name),
    service = coalesce(nullif(trim(p_service), ''), service),
    target_date = case when public.is_portal_admin() then p_target_date else target_date end,
    start_date = case when public.is_portal_admin() then p_start_date else start_date end,
    updated_at = now()
  where id = p_project_id;
  insert into public.activity (project_id, title, detail, type)
  select id, 'Project details updated', name, 'milestone' from public.projects where id = p_project_id;
end;
$$;

revoke execute on function public.update_my_project(uuid, text, text, date, date) from public;
grant execute on function public.update_my_project(uuid, text, text, date, date) to authenticated;

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
  values (p_project_id, 'Project agreement saved', v_row.project_title, 'request');

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
