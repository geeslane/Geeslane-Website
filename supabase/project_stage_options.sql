-- Optional stages: some projects skip Wireframe and/or Visual design.
-- Run in Supabase → SQL Editor.

alter table public.projects
  add column if not exists has_wireframe boolean not null default true,
  add column if not exists has_visual_design boolean not null default true;

create or replace function public.milestone_is_included(
  p_code text, p_title text, p_has_wireframe boolean, p_has_visual_design boolean
)
returns boolean
language sql
immutable
as $$
  select not (
    ((coalesce(p_code, '') = 'M3') or (coalesce(p_title, '') ilike '%wireframe%'))
      and coalesce(p_has_wireframe, true) is false
    or ((coalesce(p_code, '') = 'M4') or (coalesce(p_title, '') ilike '%visual%design%'))
      and coalesce(p_has_visual_design, true) is false
  );
$$;

create or replace function public.recalculate_portal_project(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_progress integer; v_stage text; v_has_wireframe boolean; v_has_design boolean;
begin
  select coalesce(has_wireframe, true), coalesce(has_visual_design, true)
    into v_has_wireframe, v_has_design
  from public.projects where id = p_project_id;

  select coalesce(round(100.0 * sum(weight * case status
    when 'complete' then 1
    when 'review' then 0.8
    when 'admin_review' then 0.8
    when 'current' then 0.5
    else 0 end) / nullif(sum(weight), 0)), 0)::integer
  into v_progress
  from public.milestones
  where project_id = p_project_id
    and public.milestone_is_included(code, title, v_has_wireframe, v_has_design);

  select title into v_stage
  from public.milestones
  where project_id = p_project_id
    and public.milestone_is_included(code, title, v_has_wireframe, v_has_design)
    and status in ('current', 'review', 'admin_review')
  order by sort_order
  limit 1;

  if v_stage is null then
    select title into v_stage
    from public.milestones
    where project_id = p_project_id
      and public.milestone_is_included(code, title, v_has_wireframe, v_has_design)
    order by sort_order desc
    limit 1;
  end if;

  v_stage := coalesce(v_stage, 'Launch & handover');
  update public.projects set progress = v_progress, stage = v_stage, updated_at = now() where id = p_project_id;
  return jsonb_build_object(
    'projectId', p_project_id,
    'progress', v_progress,
    'stage', v_stage,
    'hasWireframe', v_has_wireframe,
    'hasVisualDesign', v_has_design
  );
end;
$$;

create or replace function public.admin_set_project_stages(
  p_project_id uuid,
  p_has_wireframe boolean,
  p_has_visual_design boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next uuid;
  v_project jsonb;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'Project not found';
  end if;

  update public.projects
  set has_wireframe = coalesce(p_has_wireframe, true),
      has_visual_design = coalesce(p_has_visual_design, true),
      updated_at = now()
  where id = p_project_id;

  if not exists (
    select 1 from public.milestones
    where project_id = p_project_id
      and public.milestone_is_included(code, title, coalesce(p_has_wireframe, true), coalesce(p_has_visual_design, true))
      and status in ('current', 'review', 'admin_review')
  ) then
    select id into v_next
    from public.milestones
    where project_id = p_project_id
      and public.milestone_is_included(code, title, coalesce(p_has_wireframe, true), coalesce(p_has_visual_design, true))
      and status <> 'complete'
    order by sort_order
    limit 1;
    if v_next is not null then
      update public.milestones set status = 'current', updated_at = now() where id = v_next;
    end if;
  end if;

  update public.milestones
  set status = 'upcoming', updated_at = now()
  where project_id = p_project_id
    and status in ('current', 'review', 'admin_review')
    and not public.milestone_is_included(code, title, coalesce(p_has_wireframe, true), coalesce(p_has_visual_design, true));

  v_project := public.recalculate_portal_project(p_project_id);
  insert into public.activity (project_id, title, detail, type)
  values (
    p_project_id,
    'Project stages updated',
    case
      when coalesce(p_has_wireframe, true) and coalesce(p_has_visual_design, true) then 'Wireframe and visual design are included.'
      when coalesce(p_has_wireframe, true) then 'Wireframe is included. Visual design is not.'
      when coalesce(p_has_visual_design, true) then 'Visual design is included. Wireframe is not.'
      else 'Wireframe and visual design are not included.'
    end,
    'milestone'
  );
  return jsonb_build_object(
    'projectId', p_project_id,
    'hasWireframe', coalesce(p_has_wireframe, true),
    'hasVisualDesign', coalesce(p_has_visual_design, true),
    'projectUpdate', v_project
  );
end;
$$;

revoke execute on function public.admin_set_project_stages(uuid, boolean, boolean) from public;
grant execute on function public.admin_set_project_stages(uuid, boolean, boolean) to authenticated;

-- Target date is admin-only. Clients can still see it, but cannot set it.
create or replace function public.update_my_project(
  p_project_id uuid, p_name text, p_service text, p_target_date date default null
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
    updated_at = now()
  where id = p_project_id;
  insert into public.activity (project_id, title, detail, type)
  select id, 'Project details updated', name, 'milestone' from public.projects where id = p_project_id;
end;
$$;

create or replace function public.create_portal_request(
  p_project_id uuid, p_reference text, p_type text, p_title text, p_values jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.can_access_project(p_project_id) then raise exception 'Project access denied'; end if;
  if p_type not in ('discovery', 'milestone', 'change') then raise exception 'Invalid request type'; end if;
  insert into public.portal_requests (project_id, reference, type, title, payload)
  values (p_project_id, trim(p_reference), p_type, trim(p_title), coalesce(p_values, '{}'::jsonb))
  returning id into v_id;

  if p_type = 'discovery' then
    update public.projects set
      name = coalesce(nullif(trim(p_values->>'projectName'), ''), name),
      service = coalesce(nullif(trim(p_values->>'projectType'), ''), service),
      updated_at = now()
    where id = p_project_id;
    update public.brand_kits set
      personality = coalesce(nullif(trim(p_values->>'brandStyle'), ''), personality), updated_at = now()
    where project_id = p_project_id;
    if nullif(trim(p_values->>'assetFolder'), '') is not null then
      insert into public.assets (project_id, name, type, external_url)
      values (p_project_id, 'Existing brand assets', 'Shared folder', trim(p_values->>'assetFolder'));
    end if;
  end if;

  insert into public.activity (project_id, title, detail, type)
  values (p_project_id,
    case p_type when 'milestone' then 'Approval added' when 'change' then 'Change added' else 'Project brief added' end,
    trim(p_title), p_type);
  return v_id;
end;
$$;

revoke execute on function public.update_my_project(uuid, text, text, date) from public;
revoke execute on function public.create_portal_request(uuid, text, text, text, jsonb) from public;
grant execute on function public.update_my_project(uuid, text, text, date) to authenticated;
grant execute on function public.create_portal_request(uuid, text, text, text, jsonb) to authenticated;
