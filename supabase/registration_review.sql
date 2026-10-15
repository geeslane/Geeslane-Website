-- Save access-request review edits without approving or inviting.
-- Run in Supabase → SQL Editor.

alter table public.registrations
  add column if not exists review_draft jsonb not null default '{}'::jsonb;

create or replace function public.admin_save_registration_review(
  p_registration_id uuid,
  p_draft jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.registrations%rowtype;
  v_draft jsonb := coalesce(p_draft, '{}'::jsonb);
  v_service text := nullif(trim(v_draft->>'service'), '');
  v_target text := nullif(trim(v_draft->>'targetDate'), '');
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  select * into v_registration from public.registrations where id = p_registration_id for update;
  if v_registration.id is null then raise exception 'Access request not found'; end if;
  if v_registration.status <> 'Pending' then raise exception 'This request is already closed'; end if;

  update public.registrations set
    review_draft = v_draft,
    admin_notes = coalesce(v_draft->>'notes', admin_notes),
    requested_service = coalesce(v_service, requested_service),
    target_date = case when v_target is not null then v_target::date else target_date end,
    updated_at = now()
  where id = p_registration_id
  returning * into v_registration;

  return jsonb_build_object(
    'id', v_registration.id,
    'status', v_registration.status,
    'notes', v_registration.admin_notes,
    'service', v_registration.requested_service,
    'targetDate', v_registration.target_date,
    'reviewDraft', coalesce(v_registration.review_draft, '{}'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_save_registration_review(uuid, jsonb) from public;
grant execute on function public.admin_save_registration_review(uuid, jsonb) to authenticated;
