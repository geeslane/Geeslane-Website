-- Lets a signed-in client open another project without replacing the ones they already have.
-- More than one project can stay open/active at the same time. is_active only pauses a single project.
-- Run in Supabase → SQL Editor after seed_portal_project.sql / project_milestone_templates.sql.

alter table public.project_content
  add column if not exists goal text not null default '',
  add column if not exists audience text not null default '',
  add column if not exists scope text not null default '';

create or replace function public.client_add_project(
  p_name text,
  p_service text default 'Website project',
  p_values jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_project_id uuid;
  v_ref text;
  v_title text;
  v_service text;
  v_brief jsonb;
begin
  select * into v_profile from public.profiles where user_id = auth.uid();
  if v_profile.user_id is null or v_profile.status <> 'active' then raise exception 'Sign in to add a project'; end if;
  if v_profile.client_id is null then raise exception 'No client workspace is linked to this account'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter a project name'; end if;

  v_service := coalesce(nullif(trim(p_service), ''), 'Website project');
  v_project_id := public.seed_portal_project(v_profile.client_id, trim(p_name), v_service, null);
  update public.projects set is_active = true, updated_at = now() where id = v_project_id;

  v_brief := jsonb_build_object(
    'goal', coalesce(p_values->>'goal', ''),
    'audience', coalesce(p_values->>'audience', ''),
    'scope', coalesce(p_values->>'mustHaves', p_values->>'scope', ''),
    'visitorDetails', coalesce(p_values->>'mustHaves', ''),
    'features', coalesce(p_values->>'features', ''),
    'serviceLabel', v_service
  ) || coalesce(p_values, '{}'::jsonb);

  begin
    perform public.save_project_brief(v_project_id, v_brief);
  exception when undefined_function or undefined_column then
    null;
  end;
  begin
    perform public.apply_project_discovery(v_project_id, v_brief);
  exception when undefined_function or undefined_column then
    null;
  end;

  v_ref := coalesce(nullif(trim(p_values->>'id'), ''), 'GL-' || to_char(now(), 'YYYYMMDDHH24MISS'));
  v_title := coalesce(nullif(trim(p_values->>'projectName'), ''), trim(p_name));
  begin
    perform public.create_portal_request(v_project_id, v_ref, 'discovery', v_title, coalesce(p_values, '{}'::jsonb));
  exception when unique_violation then
    null;
  end;

  return jsonb_build_object(
    'id', v_project_id,
    'name', trim(p_name),
    'service', v_service
  );
end;
$$;

revoke execute on function public.client_add_project(text, text, jsonb) from public;
grant execute on function public.client_add_project(text, text, jsonb) to authenticated;
