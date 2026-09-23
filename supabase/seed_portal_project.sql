-- New projects start Discovery in progress. Admin can later set Ready for client review.
-- Run this in Supabase → SQL Editor, or run milestone_conversations.sql which includes this.

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
