-- Store the client Discovery brief (goal, audience, first version).
-- Run in Supabase → SQL Editor.

alter table public.project_content
  add column if not exists goal text not null default '',
  add column if not exists audience text not null default '',
  add column if not exists scope text not null default '';

create or replace function public.save_project_content(
  p_project_id uuid, p_content jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_project(p_project_id) then raise exception 'Project access denied'; end if;
  insert into public.project_content (
    project_id, headline, introduction, about, services, testimonials,
    call_to_action, contact_details, extra_notes, updated_at
  ) values (
    p_project_id, coalesce(p_content->>'headline', ''), coalesce(p_content->>'introduction', ''),
    coalesce(p_content->>'about', ''), coalesce(p_content->>'services', ''),
    coalesce(p_content->>'testimonials', ''), coalesce(p_content->>'callToAction', ''),
    coalesce(p_content->>'contactDetails', ''), coalesce(p_content->>'extraNotes', ''), now()
  ) on conflict (project_id) do update set
    headline = excluded.headline, introduction = excluded.introduction, about = excluded.about,
    services = excluded.services, testimonials = excluded.testimonials,
    call_to_action = excluded.call_to_action, contact_details = excluded.contact_details,
    extra_notes = excluded.extra_notes, updated_at = now();
  insert into public.activity (project_id, title, detail, type)
  values (p_project_id, 'Website content updated', 'Project copy and content notes changed.', 'request');
end;
$$;

create or replace function public.save_project_brief(
  p_project_id uuid, p_brief jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_access_project(p_project_id) then raise exception 'Project access denied'; end if;
  insert into public.project_content (project_id, goal, audience, scope, updated_at)
  values (
    p_project_id,
    coalesce(p_brief->>'goal', ''),
    coalesce(p_brief->>'audience', ''),
    coalesce(p_brief->>'scope', ''),
    now()
  ) on conflict (project_id) do update set
    goal = excluded.goal, audience = excluded.audience, scope = excluded.scope, updated_at = now();
  insert into public.portal_requests (project_id, reference, type, title, payload)
  values (p_project_id, 'PROJECT-BRIEF', 'discovery', 'Project brief', coalesce(p_brief, '{}'::jsonb))
  on conflict (project_id, reference) do update set
    payload = excluded.payload, title = excluded.title, updated_at = now();
  insert into public.activity (project_id, title, detail, type)
  values (p_project_id, 'Project brief updated', 'Goals, audience, and first-version notes changed.', 'request');
end;
$$;

revoke execute on function public.save_project_brief(uuid, jsonb) from public;
grant execute on function public.save_project_brief(uuid, jsonb) to authenticated;
grant execute on function public.save_project_content(uuid, jsonb) to authenticated;
