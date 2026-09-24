-- New projects get milestones that match the service type.
-- Website: Discovery through Launch. Automation, support, and consultation: three general phases.
-- Run in Supabase → SQL Editor after seed_portal_project.sql (or instead of re-running it).
-- Existing projects keep their current milestones.

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
