-- Partner notification queue. Run after partner_programme_ops.sql.
-- Emails are sent by send-portal-mail after the database commit.
-- Do not put COMMUNITY_MANAGER_EMAIL or the service-role key in this file.
--
-- After this script, store the dispatch secrets in Vault (SQL editor, not git):
--   select vault.create_secret('https://xostzntvowmdjlwpsevq.supabase.co/functions/v1/send-portal-mail', 'partner_notify_url');
--   select vault.create_secret('YOUR_SERVICE_ROLE_KEY', 'partner_notify_key');
-- And set the Edge Function secret COMMUNITY_MANAGER_EMAIL.
-- Then redeploy send-portal-mail.
-- pg_net makes the request to that function. Its functions live in the net schema.

create extension if not exists pg_net with schema extensions;

create table if not exists public.partner_notifications (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('referral_received', 'payout_paid')),
  event_id uuid not null,
  recipient_role text not null check (recipient_role in ('partner', 'community_manager')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text not null default '',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_type, event_id, recipient_role)
);

create index if not exists partner_notifications_status_idx on public.partner_notifications (status, created_at desc);

alter table public.partner_notifications enable row level security;
revoke all on public.partner_notifications from anon, authenticated;

create or replace function public.partner_queue_notification(
  p_event_type text,
  p_event_id uuid,
  p_recipient_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.partner_notifications (event_type, event_id, recipient_role)
  values (p_event_type, p_event_id, p_recipient_role)
  on conflict (event_type, event_id, recipient_role) do nothing;
exception when others then
  raise warning 'partner notification was not queued: %', sqlerrm;
end;
$$;

create or replace function public.partner_notification_dispatch(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_key text;
  v_schema text;
begin
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'partner_notify_url' limit 1;
    select decrypted_secret into v_key from vault.decrypted_secrets where name = 'partner_notify_key' limit 1;
  exception when undefined_table then
    update public.partner_notifications
    set last_error = 'Vault is not available, so the email could not be dispatched.', updated_at = now()
    where id = p_id and status in ('pending', 'failed');
    return;
  end;

  if coalesce(v_url, '') = '' or coalesce(v_key, '') = '' then
    update public.partner_notifications
    set last_error = 'partner_notify_url or partner_notify_key is not in Vault.', updated_at = now()
    where id = p_id and status in ('pending', 'failed');
    return;
  end if;

  select n.nspname into v_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'http_post' and n.nspname in ('net', 'extensions')
  order by case n.nspname when 'net' then 0 else 1 end
  limit 1;

  if v_schema is null then
    update public.partner_notifications
    set last_error = 'pg_net is not installed, so the email could not be dispatched.', updated_at = now()
    where id = p_id and status in ('pending', 'failed');
    return;
  end if;

  execute format('select %I.http_post($1, $2, $3, $4, $5)', v_schema)
  using v_url,
        jsonb_build_object('kind', 'partner-notification', 'notificationId', p_id),
        '{}'::jsonb,
        jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
        5000;
exception when others then
  update public.partner_notifications
  set last_error = left(sqlerrm, 240), updated_at = now()
  where id = p_id and status in ('pending', 'failed');
end;
$$;

create or replace function public.partner_notification_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.partner_notification_dispatch(new.id);
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists partner_notification_dispatch on public.partner_notifications;
create trigger partner_notification_dispatch
  after insert on public.partner_notifications
  for each row execute function public.partner_notification_after_insert();

create or replace function public.claim_partner_notification(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partner_notifications%rowtype;
  v_partner public.partners%rowtype;
  v_referral public.partner_referrals%rowtype;
  v_payout public.partner_payouts%rowtype;
  v_lines jsonb;
begin
  select * into v_row
  from public.partner_notifications
  where id = p_id
    and (
      status in ('pending', 'failed')
      or (status = 'sending' and updated_at < now() - interval '10 minutes')
    )
  for update;

  if v_row.id is null then
    return null;
  end if;

  update public.partner_notifications
  set status = 'sending', attempts = attempts + 1, updated_at = now(), last_error = ''
  where id = v_row.id;

  if v_row.event_type = 'referral_received' and v_row.recipient_role = 'community_manager' then
    select * into v_referral from public.partner_referrals where id = v_row.event_id;
    if v_referral.id is null then
      update public.partner_notifications set status = 'failed', last_error = 'Referral was not found.', updated_at = now() where id = v_row.id;
      return null;
    end if;
    select * into v_partner from public.partners where id = v_referral.partner_id;
    return jsonb_build_object(
      'role', 'community_manager',
      'eventType', 'referral_received',
      'partnerName', v_partner.full_name,
      'partnerPhone', v_partner.phone,
      'code', v_partner.code,
      'business', v_referral.business_name,
      'service', v_referral.service,
      'registeredAt', v_referral.created_at
    );
  end if;

  if v_row.event_type = 'payout_paid' then
    select * into v_payout from public.partner_payouts where id = v_row.event_id;
    if v_payout.id is null then
      update public.partner_notifications set status = 'failed', last_error = 'Payout was not found.', updated_at = now() where id = v_row.id;
      return null;
    end if;
    select * into v_partner from public.partners where id = v_payout.partner_id;
    select coalesce(jsonb_agg(jsonb_build_object(
      'project', item.project,
      'commission', item.commission
    )), '[]'::jsonb)
    into v_lines
    from (
      select coalesce(nullif(e.project_name, ''), r.business_name, 'Project') as project,
             e.commission
      from public.partner_earnings e
      join public.partner_referrals r on r.id = e.referral_id
      where e.payout_id = v_payout.id
      order by e.created_at
    ) item;

    return jsonb_build_object(
      'role', v_row.recipient_role,
      'eventType', 'payout_paid',
      'partnerName', v_partner.full_name,
      'partnerPhone', v_partner.phone,
      'partnerEmail', case when v_row.recipient_role = 'partner' then v_partner.email else null end,
      'amount', v_payout.amount,
      'paidOn', v_payout.transferred_on,
      'reference', v_payout.reference,
      'lines', v_lines
    );
  end if;

  update public.partner_notifications
  set status = 'failed', last_error = 'Unknown notification.', updated_at = now()
  where id = v_row.id;
  return null;
end;
$$;

create or replace function public.complete_partner_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_notifications
  set status = 'sent', sent_at = now(), last_error = '', updated_at = now()
  where id = p_id and status = 'sending';
end;
$$;

create or replace function public.fail_partner_notification(p_id uuid, p_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_notifications
  set status = 'failed', last_error = left(coalesce(p_error, 'Delivery failed'), 240), updated_at = now()
  where id = p_id and status = 'sending';
end;
$$;

create or replace function public.admin_partner_notifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id,
      'eventType', n.event_type,
      'role', n.recipient_role,
      'status', n.status,
      'attempts', n.attempts,
      'lastError', n.last_error,
      'createdAt', n.created_at,
      'sentAt', n.sent_at,
      'partnerName', case
        when n.event_type = 'referral_received' then (
          select p.full_name from public.partner_referrals r
          join public.partners p on p.id = r.partner_id
          where r.id = n.event_id
        )
        else (
          select p.full_name from public.partner_payouts po
          join public.partners p on p.id = po.partner_id
          where po.id = n.event_id
        )
      end
    ) order by n.created_at desc)
    from public.partner_notifications n
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_retry_partner_notification(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  select status into v_status from public.partner_notifications where id = p_id for update;
  if v_status is null then raise exception 'Partner: That notification was not found.'; end if;
  if v_status = 'sent' then return; end if;
  if v_status = 'pending' then
    perform public.partner_notification_dispatch(p_id);
    return;
  end if;
  if v_status = 'sending' and not exists (
    select 1 from public.partner_notifications
    where id = p_id and updated_at < now() - interval '10 minutes'
  ) then
    raise exception 'Partner: That email is already being sent.';
  end if;
  update public.partner_notifications
  set status = 'pending', last_error = '', updated_at = now()
  where id = p_id and status in ('failed', 'sending');
  perform public.partner_notification_dispatch(p_id);
end;
$$;

create or replace function public.attach_partner_referral(
  p_registration_id uuid,
  p_email text,
  p_business text,
  p_service text,
  p_code text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(regexp_replace(trim(coalesce(p_code, '')), '\s', '', 'g'));
  v_email text := lower(trim(coalesce(p_email, '')));
  v_partner public.partners%rowtype;
  v_today date := public.partner_lagos_today();
  v_id uuid;
  v_business text := trim(coalesce(p_business, ''));
begin
  if v_code = '' or position('@' in v_email) < 2 then return; end if;
  if v_today < date '2026-11-01' or v_today > date '2026-11-30' then return; end if;
  select * into v_partner from public.partners where code = v_code;
  if v_partner.id is null then return; end if;
  if exists (select 1 from public.partner_referrals where lower(email) = v_email) then return; end if;

  insert into public.partner_referrals (partner_id, registration_id, email, business_name, service, pipeline, eligibility)
  values (v_partner.id, p_registration_id, v_email, v_business, trim(coalesce(p_service, '')), 'new', 'pending')
  returning id into v_id;

  perform public.partner_notice(
    v_partner.id,
    'A request came in from ' || coalesce(nullif(v_business, ''), 'a business') || '. Geeslane will review it. You will see updates here. The client''s contact details stay with Geeslane.'
  );
  perform public.partner_audit('referral_received', v_partner.id, v_id, jsonb_build_object('business', v_business, 'service', trim(coalesce(p_service, '')), 'code', v_code));
  perform public.partner_queue_notification('referral_received', v_id, 'community_manager');
exception when unique_violation then
  return;
end;
$$;

create or replace function public.admin_record_partner_payout(
  p_partner_id uuid,
  p_earning_ids uuid[],
  p_amount numeric,
  p_transferred_on date,
  p_reference text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := public.partner_lagos_today();
  v_reference text := trim(coalesce(p_reference, ''));
  v_note text := trim(coalesce(p_note, ''));
  v_amount numeric(12, 2) := round(coalesce(p_amount, 0), 2);
  v_sum numeric(12, 2);
  v_count int;
  v_id uuid;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if p_earning_ids is null or cardinality(p_earning_ids) = 0 then
    raise exception 'Partner: Choose at least one commission to settle.';
  end if;
  if p_transferred_on is null or p_transferred_on > v_today then
    raise exception 'Partner: Enter the date you transferred the money.';
  end if;
  if length(v_reference) < 3 then raise exception 'Partner: Enter the transfer reference.'; end if;
  if v_amount <= 0 then raise exception 'Partner: Enter the amount you transferred.'; end if;

  perform 1 from public.partner_earnings
  where id = any(p_earning_ids) and partner_id = p_partner_id and payout_status = 'due'
  for update;

  select count(*), coalesce(sum(commission), 0)
  into v_count, v_sum
  from public.partner_earnings
  where id = any(p_earning_ids)
    and partner_id = p_partner_id
    and payout_status = 'due';

  if v_count <> cardinality(p_earning_ids) then
    raise exception 'Partner: Each selected commission must still be awaiting transfer for this partner.';
  end if;
  if abs(v_sum - v_amount) > 0.009 then
    raise exception 'Partner: The transfer amount must match the selected commissions.';
  end if;

  insert into public.partner_payouts (partner_id, amount, transferred_on, reference, note)
  values (p_partner_id, v_amount, p_transferred_on, v_reference, v_note)
  returning id into v_id;

  update public.partner_earnings
  set payout_status = 'paid', payout_on = p_transferred_on, payout_id = v_id, receipt_note = v_reference
  where id = any(p_earning_ids);

  perform public.partner_notice(
    p_partner_id,
    'Geeslane transferred NGN ' || trim(to_char(v_amount, 'FM999,999,990.00'))
      || ' to your registered account. Reference: ' || v_reference || '.'
  );
  perform public.partner_audit('payout_recorded', p_partner_id, null, jsonb_build_object(
    'payoutId', v_id, 'amount', v_amount, 'reference', v_reference, 'earningIds', to_jsonb(p_earning_ids)
  ));
  perform public.partner_queue_notification('payout_paid', v_id, 'partner');
  perform public.partner_queue_notification('payout_paid', v_id, 'community_manager');
  return v_id;
end;
$$;

revoke all on function public.partner_queue_notification(text, uuid, text) from public;
revoke all on function public.partner_notification_dispatch(uuid) from public;
revoke all on function public.partner_notification_after_insert() from public;
revoke all on function public.claim_partner_notification(uuid) from public, anon, authenticated;
revoke all on function public.complete_partner_notification(uuid) from public, anon, authenticated;
revoke all on function public.fail_partner_notification(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_partner_notifications() from public;
revoke all on function public.admin_retry_partner_notification(uuid) from public;

grant execute on function public.claim_partner_notification(uuid) to service_role;
grant execute on function public.complete_partner_notification(uuid) to service_role;
grant execute on function public.fail_partner_notification(uuid, text) to service_role;
grant execute on function public.admin_partner_notifications() to authenticated;
grant execute on function public.admin_retry_partner_notification(uuid) to authenticated;
