-- November Partner Programme operations.
-- Run in Supabase → SQL Editor after partner_programme.sql.
-- Then redeploy supabase/functions/send-portal-mail.
-- Safe to re-run. Does not delete partner, referral, or earning rows.

alter table public.partners
  add column if not exists status text not null default 'active',
  add column if not exists access_status text not null default 'active',
  add column if not exists admin_notified_at timestamptz;

alter table public.partner_referrals
  add column if not exists pipeline text not null default 'new',
  add column if not exists eligibility text not null default 'pending',
  add column if not exists ineligible_reason text not null default '',
  add column if not exists notes text not null default '',
  add column if not exists quote_amount numeric(12, 2),
  add column if not exists eligible_fee numeric(12, 2),
  add column if not exists quote_sent_on date;

alter table public.partner_earnings
  add column if not exists gross_amount numeric(12, 2),
  add column if not exists third_party numeric(12, 2) not null default 0,
  add column if not exists payment_reference text not null default '',
  add column if not exists verified_at timestamptz;

alter table public.partner_notices
  add column if not exists kind text not null default 'update',
  add column if not exists referral_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_notices_referral_id_fkey'
  ) then
    alter table public.partner_notices
      add constraint partner_notices_referral_id_fkey
      foreign key (referral_id) references public.partner_referrals(id) on delete cascade;
  end if;
end $$;

create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  transferred_on date not null,
  reference text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.partner_earnings
  add column if not exists payout_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'partner_earnings_payout_id_fkey'
  ) then
    alter table public.partner_earnings
      add constraint partner_earnings_payout_id_fkey
      foreign key (payout_id) references public.partner_payouts(id);
  end if;
end $$;

create table if not exists public.partner_payments (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.partner_referrals(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  earning_id uuid references public.partner_earnings(id),
  kind text not null check (kind in ('first', 'second')),
  project_name text not null default '',
  gross_amount numeric(12, 2) not null default 0,
  eligible_fee numeric(12, 2) not null,
  third_party numeric(12, 2) not null default 0,
  cleared_on date not null,
  reference text not null default '',
  verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referral_id, kind)
);

create table if not exists public.partner_audit (
  id uuid primary key default gen_random_uuid(),
  actor text not null default '',
  action text not null,
  partner_id uuid,
  referral_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists partner_audit_created_idx on public.partner_audit (created_at desc);
create index if not exists partner_audit_partner_idx on public.partner_audit (partner_id, created_at desc);
create index if not exists partner_audit_referral_idx on public.partner_audit (referral_id, created_at desc);

do $$
declare r record;
begin
  for r in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname in ('partners', 'partner_referrals', 'partner_earnings')
      and con.contype = 'c'
      and (
        pg_get_constraintdef(con.oid) ~* 'payout_status|pipeline|eligibility|access_status'
        or (rel.relname in ('partners', 'partner_referrals') and pg_get_constraintdef(con.oid) ~* 'status')
      )
  loop
    execute format('alter table public.%I drop constraint %I', r.relname, r.conname);
  end loop;
end $$;

alter table public.partners
  add constraint partners_status_check check (status in ('active', 'suspended')),
  add constraint partners_access_status_check check (access_status in ('active', 'revoked'));

alter table public.partner_referrals
  add constraint partner_referrals_status_check check (status in ('requested', 'qualified', 'excluded', 'cancelled')),
  add constraint partner_referrals_pipeline_check check (pipeline in (
    'new', 'under_review', 'contacted', 'quote_sent', 'awaiting_initial',
    'initial_received', 'awaiting_balance', 'fully_paid', 'cancelled', 'ineligible'
  )),
  add constraint partner_referrals_eligibility_check check (eligibility in ('pending', 'eligible', 'ineligible'));

alter table public.partner_earnings
  add constraint partner_earnings_payout_status_check check (payout_status in ('due', 'paid', 'forfeited'));

update public.partner_referrals
set pipeline = 'awaiting_balance', eligibility = 'eligible'
where status = 'qualified' and pipeline = 'new';

update public.partner_referrals
set pipeline = 'ineligible', eligibility = 'ineligible',
    ineligible_reason = case when ineligible_reason = '' then 'prior_conversation' else ineligible_reason end
where status = 'excluded' and pipeline = 'new';

alter table public.partner_payouts enable row level security;
alter table public.partner_payments enable row level security;
alter table public.partner_audit enable row level security;
revoke all on public.partner_payouts from anon, authenticated;
revoke all on public.partner_payments from anon, authenticated;
revoke all on public.partner_audit from anon, authenticated;

create or replace function public.partner_audit(
  p_action text,
  p_partner_id uuid,
  p_referral_id uuid,
  p_detail jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.partner_audit (actor, action, partner_id, referral_id, detail)
  values (
    coalesce(nullif(auth.jwt() ->> 'email', ''), 'system'),
    left(trim(coalesce(p_action, 'update')), 80),
    p_partner_id,
    p_referral_id,
    coalesce(p_detail, '{}'::jsonb)
  );
end;
$$;

create or replace function public.partner_notice(p_partner_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.partner_notices (partner_id, body) values (p_partner_id, trim(p_body));
end;
$$;

create or replace function public.partner_room(p_referral_id uuid)
returns numeric
language sql
stable
as $$
  select greatest(0, 100000 - coalesce((
    select sum(commission)
    from public.partner_earnings
    where referral_id = p_referral_id
      and payout_status <> 'forfeited'
  ), 0));
$$;

create or replace function public.partner_forfeit_open(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_earnings
  set payout_status = 'forfeited',
      receipt_note = case when receipt_note = '' then 'Forfeited' else receipt_note end
  where referral_id = p_referral_id and payout_status = 'due';
end;
$$;

create or replace function public.register_partner(
  p_name text,
  p_email text,
  p_phone text,
  p_bank_name text,
  p_account_number text,
  p_account_name text,
  p_whatsapp boolean,
  p_terms boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_account text := regexp_replace(trim(coalesce(p_account_name, '')), '\s+', ' ', 'g');
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
  v_bank text := trim(coalesce(p_bank_name, ''));
  v_number text := regexp_replace(coalesce(p_account_number, ''), '\s', '', 'g');
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_token text;
  v_id uuid;
  i int;
begin
  if public.partner_lagos_today() > date '2026-11-30' then
    raise exception 'Partner: Partner registration closed on 30 November 2026.';
  end if;
  if length(v_name) < 2 or position('@' in v_email) < 2 or length(regexp_replace(v_phone, '\D', '', 'g')) < 7 then
    raise exception 'Partner: Enter your name, email, and phone number.';
  end if;
  if not public.partner_same_name(v_name, v_account) then
    raise exception 'Partner: The account name must match the name on this form.';
  end if;
  if length(v_bank) < 2 or v_number !~ '^[0-9]{10}$' then
    raise exception 'Partner: Enter the bank name and the 10-digit account number.';
  end if;
  if coalesce(p_whatsapp, false) is not true then
    raise exception 'Partner: Confirm that you have joined the WhatsApp group before sending.';
  end if;
  if coalesce(p_terms, false) is not true then
    raise exception 'Partner: Read the terms and tick the box before sending.';
  end if;
  if exists (select 1 from public.partners where email = v_email) then
    raise exception 'Partner: This email is already registered. Open the link in your welcome email.';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.partners where code = v_code);
  end loop;
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.partners (full_name, email, phone, bank_name, account_number, account_name, code, token)
  values (v_name, v_email, v_phone, v_bank, v_number, v_account, v_code, v_token)
  returning id into v_id;

  perform public.partner_notice(v_id, 'Your invite link is ready. It works from 1 November through 30 November 2026.');
  perform public.partner_audit('partner_registered', v_id, null, jsonb_build_object('email', v_email, 'phone', v_phone, 'code', v_code));

  return jsonb_build_object('name', v_name, 'email', v_email, 'code', v_code, 'token', v_token, 'id', v_id);
end;
$$;

create or replace function public.partner_mark_admin_notified(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partners
  set admin_notified_at = coalesce(admin_notified_at, now())
  where token = trim(coalesce(p_token, '')) and access_status = 'active';
end;
$$;

create or replace function public.admin_mark_partner_notified(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  update public.partners set admin_notified_at = now() where id = p_partner_id;
  perform public.partner_audit('admin_notified', p_partner_id, null, '{}'::jsonb);
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
  begin
    perform public.partner_queue_notification('referral_received', v_id, 'community_manager');
  exception when undefined_function then
    null;
  end;
exception when unique_violation then
  return;
end;
$$;

create or replace function public.partner_project_snapshot(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row jsonb;
begin
  select jsonb_build_object('name', pr.name, 'service', pr.service, 'createdAt', pr.created_at)
  into v_row
  from public.projects pr
  join public.clients c on c.id = pr.client_id
  where lower(c.email) = lower(trim(coalesce(p_email, '')))
  order by pr.created_at desc
  limit 1;
  return v_row;
exception when undefined_table or undefined_column then
  return null;
end;
$$;

create or replace function public.admin_partner_bank(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partners%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  select * into v_row from public.partners where id = p_partner_id;
  if v_row.id is null then raise exception 'Partner: That partner was not found.'; end if;
  return jsonb_build_object(
    'bankName', v_row.bank_name,
    'accountName', v_row.account_name,
    'accountNumber', v_row.account_number
  );
end;
$$;

create or replace function public.admin_partner_record(p_partner_id uuid default null, p_referral_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.partner_referrals%rowtype;
  v_request jsonb;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if p_referral_id is not null then
    select * into v_referral from public.partner_referrals where id = p_referral_id;
    if v_referral.id is null then raise exception 'Partner: That referral was not found.'; end if;
    select jsonb_build_object(
      'name', g.name, 'email', g.email, 'phone', g.phone, 'business', g.business,
      'service', g.requested_service, 'description', g.project_description,
      'contact', g.contact_preference, 'submittedAt', g.created_at
    ) into v_request
    from public.registrations g where g.id = v_referral.registration_id;
    return jsonb_build_object(
      'request', v_request,
      'project', public.partner_project_snapshot(v_referral.email),
      'audit', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', a.id, 'actor', a.actor, 'action', a.action, 'detail', a.detail, 'createdAt', a.created_at
        ) order by a.created_at desc)
        from public.partner_audit a where a.referral_id = v_referral.id
      ), '[]'::jsonb)
    );
  end if;
  return jsonb_build_object(
    'audit', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'actor', a.actor, 'action', a.action, 'detail', a.detail, 'createdAt', a.created_at
      ) order by a.created_at desc)
      from public.partner_audit a where a.partner_id = p_partner_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_partner_board()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  return jsonb_build_object(
    'stats', jsonb_build_object(
      'partners', (select count(*) from public.partners),
      'referrals', (select count(*) from public.partner_referrals),
      'awaitingReview', (select count(*) from public.partner_referrals where eligibility = 'pending' and pipeline not in ('cancelled', 'ineligible')),
      'qualified', (select count(*) from public.partner_referrals where status = 'qualified'),
      'initialPayments', (select count(*) from public.partner_earnings where kind = 'first' and payout_status <> 'forfeited'),
      'commissionEarned', coalesce((select sum(commission) from public.partner_earnings where payout_status in ('due', 'paid')), 0),
      'awaitingTransfer', coalesce((select sum(commission) from public.partner_earnings where payout_status = 'due'), 0),
      'transferred', coalesce((select sum(commission) from public.partner_earnings where payout_status = 'paid'), 0)
    ),
    'partners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.full_name, 'email', p.email, 'phone', p.phone,
        'bankName', p.bank_name, 'accountName', p.account_name,
        'accountLast4', right(p.account_number, 4),
        'code', p.code, 'createdAt', p.created_at,
        'status', p.status, 'accessStatus', p.access_status,
        'adminNotifiedAt', p.admin_notified_at,
        'referralCount', (select count(*) from public.partner_referrals r where r.partner_id = p.id),
        'commissionEarned', coalesce((select sum(e.commission) from public.partner_earnings e where e.partner_id = p.id and e.payout_status in ('due', 'paid')), 0),
        'commissionPaid', coalesce((select sum(e.commission) from public.partner_earnings e where e.partner_id = p.id and e.payout_status = 'paid'), 0)
      ) order by p.created_at desc)
      from public.partners p
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'partnerId', r.partner_id, 'partnerName', p.full_name, 'code', p.code,
        'business', r.business_name, 'service', r.service, 'email', r.email,
        'status', r.status, 'pipeline', r.pipeline, 'eligibility', r.eligibility,
        'ineligibleReason', r.ineligible_reason, 'notes', r.notes,
        'quoteAmount', r.quote_amount, 'eligibleFee', r.eligible_fee, 'quoteSentOn', r.quote_sent_on,
        'createdAt', r.created_at, 'qualifiedAt', r.qualified_at,
        'clientName', g.name, 'clientEmail', g.email, 'clientPhone', g.phone,
        'description', g.project_description, 'submittedAt', g.created_at
      ) order by r.created_at desc)
      from public.partner_referrals r
      join public.partners p on p.id = r.partner_id
      left join public.registrations g on g.id = r.registration_id
    ), '[]'::jsonb),
    'earnings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'referralId', e.referral_id, 'partnerId', e.partner_id,
        'partnerName', p.full_name, 'business', r.business_name,
        'project', e.project_name, 'kind', e.kind, 'fee', e.fee, 'commission', e.commission,
        'gross', e.gross_amount, 'thirdParty', e.third_party, 'reference', e.payment_reference,
        'clientPaidOn', e.client_paid_on, 'payoutStatus', e.payout_status,
        'payoutOn', e.payout_on, 'payoutId', e.payout_id, 'receipt', e.receipt_note,
        'verifiedAt', e.verified_at, 'createdAt', e.created_at
      ) order by e.created_at desc)
      from public.partner_earnings e
      join public.partner_referrals r on r.id = e.referral_id
      join public.partners p on p.id = e.partner_id
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', po.id, 'partnerId', po.partner_id, 'partnerName', p.full_name,
        'amount', po.amount, 'transferredOn', po.transferred_on,
        'reference', po.reference, 'note', po.note, 'createdAt', po.created_at,
        'earnings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id, 'business', r.business_name, 'kind', e.kind, 'commission', e.commission
          ))
          from public.partner_earnings e
          join public.partner_referrals r on r.id = e.referral_id
          where e.payout_id = po.id
        ), '[]'::jsonb)
      ) order by po.created_at desc)
      from public.partner_payouts po
      join public.partners p on p.id = po.partner_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.partner_board(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner public.partners%rowtype;
begin
  select * into v_partner from public.partners where token = trim(coalesce(p_token, ''));
  if v_partner.id is null or v_partner.access_status <> 'active' then
    raise exception 'Partner: This partner link is not valid. Open the link in your welcome email.';
  end if;
  return jsonb_build_object(
    'name', v_partner.full_name,
    'code', v_partner.code,
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', n.id, 'body', n.body, 'kind', n.kind, 'createdAt', n.created_at, 'read', n.read_at is not null
      ) order by n.created_at desc)
      from public.partner_notices n where n.partner_id = v_partner.id
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'business', r.business_name, 'service', r.service, 'status', r.status,
        'pipeline', r.pipeline, 'eligibility', r.eligibility, 'createdAt', r.created_at,
        'updates', coalesce((
          select jsonb_agg(n.body order by n.created_at desc)
          from public.partner_notices n
          where n.referral_id = r.id and n.partner_id = v_partner.id
        ), '[]'::jsonb),
        'earnings', coalesce((
          select jsonb_agg(jsonb_build_object(
            'project', e.project_name, 'kind', e.kind, 'fee', e.fee, 'commission', e.commission,
            'clientPaidOn', e.client_paid_on, 'payoutStatus', e.payout_status,
            'payoutOn', e.payout_on, 'receipt', e.receipt_note
          ) order by e.client_paid_on, e.created_at)
          from public.partner_earnings e where e.referral_id = r.id
        ), '[]'::jsonb)
      ) order by r.created_at desc)
      from public.partner_referrals r where r.partner_id = v_partner.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.admin_update_referral(
  p_referral_id uuid,
  p_pipeline text,
  p_notes text,
  p_quote_amount numeric,
  p_eligible_fee numeric,
  p_quote_sent_on date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partner_referrals%rowtype;
  v_pipeline text := lower(trim(coalesce(p_pipeline, '')));
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if v_pipeline in ('cancelled', 'ineligible') then
    raise exception 'Partner: Use the eligibility or cancel action for that decision.';
  end if;
  if v_pipeline not in ('new', 'under_review', 'contacted', 'quote_sent', 'awaiting_initial', 'initial_received', 'awaiting_balance', 'fully_paid') then
    raise exception 'Partner: Choose a referral status.';
  end if;
  select * into v_row from public.partner_referrals where id = p_referral_id for update;
  if v_row.id is null then raise exception 'Partner: That referral was not found.'; end if;
  if v_row.pipeline in ('cancelled', 'ineligible') then
    raise exception 'Partner: This referral is already closed.';
  end if;
  update public.partner_referrals set
    pipeline = v_pipeline,
    notes = coalesce(p_notes, ''),
    quote_amount = p_quote_amount,
    eligible_fee = p_eligible_fee,
    quote_sent_on = case
      when v_pipeline in ('quote_sent', 'awaiting_initial') and p_quote_sent_on is null then coalesce(v_row.quote_sent_on, public.partner_lagos_today())
      else p_quote_sent_on
    end
  where id = v_row.id;
  perform public.partner_audit('referral_updated', v_row.partner_id, v_row.id, jsonb_build_object(
    'pipeline', v_pipeline, 'previous', v_row.pipeline, 'quoteSentOn', coalesce(p_quote_sent_on, v_row.quote_sent_on)
  ));
end;
$$;

create or replace function public.admin_set_referral_eligibility(
  p_referral_id uuid,
  p_eligibility text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partner_referrals%rowtype;
  v_eligibility text := lower(trim(coalesce(p_eligibility, '')));
  v_reason text := lower(trim(coalesce(p_reason, '')));
  v_notice text;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if v_eligibility not in ('pending', 'eligible', 'ineligible') then
    raise exception 'Partner: Choose an eligibility decision.';
  end if;
  select * into v_row from public.partner_referrals where id = p_referral_id for update;
  if v_row.id is null then raise exception 'Partner: That referral was not found.'; end if;
  if v_eligibility = 'ineligible' and v_reason not in ('existing_client', 'prior_conversation', 'outside_window', 'initial_not_in_november', 'other') then
    raise exception 'Partner: Choose why this referral is not eligible.';
  end if;
  if v_eligibility = 'ineligible' then
    perform public.partner_forfeit_open(v_row.id);
    update public.partner_referrals
    set eligibility = 'ineligible', pipeline = 'ineligible', status = 'excluded', ineligible_reason = v_reason
    where id = v_row.id;
    v_notice := v_row.business_name || ' does not count for the November programme.';
    v_notice := v_notice || case v_reason
      when 'existing_client' then ' They are already a Geeslane client.'
      when 'prior_conversation' then ' Geeslane was already speaking with them.'
      when 'outside_window' then ' The request arrived outside 1–30 November 2026.'
      when 'initial_not_in_november' then ' The initial payment did not clear in November.'
      else ''
    end;
    if v_row.eligibility is distinct from 'ineligible' then
      perform public.partner_notice(v_row.partner_id, v_notice);
    end if;
  elsif v_eligibility = 'eligible' then
    update public.partner_referrals
    set eligibility = 'eligible',
        pipeline = case
          when exists (select 1 from public.partner_earnings where referral_id = v_row.id and kind = 'second' and payout_status <> 'forfeited') then 'fully_paid'
          when exists (select 1 from public.partner_earnings where referral_id = v_row.id and kind = 'first' and payout_status <> 'forfeited') then 'awaiting_balance'
          when pipeline in ('ineligible', 'new') then 'under_review'
          else pipeline
        end,
        status = case
          when status = 'excluded' and exists (select 1 from public.partner_earnings where referral_id = v_row.id and kind = 'first') then 'qualified'
          when status = 'excluded' then 'requested'
          else status
        end,
        ineligible_reason = ''
    where id = v_row.id;
    if v_row.eligibility is distinct from 'eligible' then
      perform public.partner_notice(v_row.partner_id, v_row.business_name || ' is eligible for the November programme.');
    end if;
  else
    update public.partner_referrals
    set eligibility = 'pending', ineligible_reason = ''
    where id = v_row.id and status not in ('cancelled');
  end if;
  perform public.partner_audit('eligibility_set', v_row.partner_id, v_row.id, jsonb_build_object('eligibility', v_eligibility, 'reason', v_reason));
end;
$$;

create or replace function public.admin_cancel_referral(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partner_referrals%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  select * into v_row from public.partner_referrals where id = p_referral_id for update;
  if v_row.id is null then raise exception 'Partner: That referral was not found.'; end if;
  if v_row.pipeline = 'cancelled' or v_row.status = 'cancelled' then
    raise exception 'Partner: This referral is already cancelled.';
  end if;
  perform public.partner_forfeit_open(v_row.id);
  update public.partner_referrals
  set pipeline = 'cancelled', status = 'cancelled'
  where id = v_row.id;
  perform public.partner_notice(
    v_row.partner_id,
    v_row.business_name || ' was cancelled. Commission already transferred stays with you. Any amount not yet transferred will not be paid.'
  );
  perform public.partner_audit('referral_cancelled', v_row.partner_id, v_row.id, '{}'::jsonb);
end;
$$;

create or replace function public.admin_exclude_referral(p_referral_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_set_referral_eligibility(p_referral_id, 'ineligible', 'prior_conversation');
end;
$$;

create or replace function public.admin_record_partner_payment(
  p_referral_id uuid,
  p_kind text,
  p_project_name text,
  p_gross numeric,
  p_eligible_fee numeric,
  p_third_party numeric,
  p_paid_on date,
  p_reference text,
  p_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.partner_referrals%rowtype;
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_gross numeric(12, 2) := round(coalesce(p_gross, 0), 2);
  v_fee numeric(12, 2) := round(coalesce(p_eligible_fee, 0), 2);
  v_third numeric(12, 2) := round(coalesce(p_third_party, 0), 2);
  v_project text := trim(coalesce(p_project_name, ''));
  v_reference text := trim(coalesce(p_reference, ''));
  v_today date := public.partner_lagos_today();
  v_room numeric;
  v_commission numeric(12, 2);
  v_earning_id uuid;
  v_partner_email text;
  v_partner_name text;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if coalesce(p_verified, false) is not true then
    raise exception 'Partner: Confirm that the client payment has cleared before saving.';
  end if;
  select * into v_referral from public.partner_referrals where id = p_referral_id for update;
  if v_referral.id is null then raise exception 'Partner: That referral was not found.'; end if;
  if v_referral.eligibility = 'ineligible' or v_referral.pipeline in ('ineligible', 'cancelled') or v_referral.status in ('excluded', 'cancelled') then
    raise exception 'Partner: This referral cannot earn commission.';
  end if;
  if v_referral.eligibility <> 'eligible' then
    raise exception 'Partner: Mark the referral eligible before recording a payment.';
  end if;
  if v_kind not in ('first', 'second') then raise exception 'Partner: Choose the initial 50%% or the final 50%%.'; end if;
  if v_fee <= 0 then raise exception 'Partner: Enter the eligible Geeslane service fee for this payment.'; end if;
  if v_third < 0 or v_gross < 0 then raise exception 'Partner: Amounts cannot be negative.'; end if;
  if v_gross > 0 and v_fee > v_gross - v_third + 0.009 then
    raise exception 'Partner: The eligible fee cannot include third-party costs.';
  end if;
  if length(v_project) < 2 then v_project := coalesce(nullif(v_referral.business_name, ''), 'Project'); end if;
  if p_paid_on is null or p_paid_on > v_today then raise exception 'Partner: Enter the date the client payment cleared.'; end if;
  if length(v_reference) < 3 then raise exception 'Partner: Enter the payment reference.'; end if;

  if v_kind = 'first' then
    if exists (select 1 from public.partner_earnings where referral_id = v_referral.id and kind = 'first') then
      raise exception 'Partner: That payment is already recorded.';
    end if;
    if p_paid_on < date '2026-11-01' or p_paid_on > date '2026-11-30' then
      raise exception 'Partner: The first payment has to clear between 1 and 30 November 2026.';
    end if;
  else
    if not exists (select 1 from public.partner_earnings where referral_id = v_referral.id and kind = 'first' and payout_status <> 'forfeited') then
      raise exception 'Partner: Record the initial 50%% before the final 50%%.';
    end if;
    if exists (select 1 from public.partner_earnings where referral_id = v_referral.id and kind = 'second') then
      raise exception 'Partner: That payment is already recorded.';
    end if;
    if p_paid_on < date '2026-11-01' then raise exception 'Partner: Enter the date the client payment cleared.'; end if;
  end if;

  v_room := public.partner_room(v_referral.id);
  v_commission := least(round(v_fee * 0.2, 2), v_room);
  if v_commission <= 0 then raise exception 'Partner: This project has reached the NGN 100,000 cap.'; end if;

  insert into public.partner_earnings (
    partner_id, referral_id, project_name, kind, fee, commission, client_paid_on,
    gross_amount, third_party, payment_reference, verified_at
  ) values (
    v_referral.partner_id, v_referral.id, v_project, v_kind, v_fee, v_commission, p_paid_on,
    nullif(v_gross, 0), v_third, v_reference, now()
  ) returning id into v_earning_id;

  insert into public.partner_payments (
    referral_id, partner_id, earning_id, kind, project_name, gross_amount, eligible_fee,
    third_party, cleared_on, reference, verified, verified_at
  ) values (
    v_referral.id, v_referral.partner_id, v_earning_id, v_kind, v_project, v_gross, v_fee,
    v_third, p_paid_on, v_reference, true, now()
  );

  if v_kind = 'first' then
    update public.partner_referrals
    set status = 'qualified', qualified_at = coalesce(qualified_at, now()), pipeline = 'awaiting_balance'
    where id = v_referral.id;
  else
    update public.partner_referrals set pipeline = 'fully_paid' where id = v_referral.id;
  end if;

  perform public.partner_notice(
    v_referral.partner_id,
    v_referral.business_name || ' — ' || case when v_kind = 'first' then 'Initial 50%' else 'Final 50%' end
      || ' cleared. Commission earned: NGN ' || trim(to_char(v_commission, 'FM999,999,990.00'))
      || ' on the eligible Geeslane fee of NGN ' || trim(to_char(v_fee, 'FM999,999,990.00')) || '.'
  );
  perform public.partner_audit('payment_verified', v_referral.partner_id, v_referral.id, jsonb_build_object(
    'kind', v_kind, 'eligibleFee', v_fee, 'commission', v_commission, 'clearedOn', p_paid_on, 'reference', v_reference
  ));

  select email, full_name into v_partner_email, v_partner_name from public.partners where id = v_referral.partner_id;
  return jsonb_build_object(
    'commission', v_commission,
    'fee', v_fee,
    'kind', v_kind,
    'business', v_referral.business_name,
    'partnerEmail', v_partner_email,
    'partnerName', v_partner_name
  );
end;
$$;

create or replace function public.partner_add_earning(
  p_referral_id uuid,
  p_project_name text,
  p_kind text,
  p_fee numeric,
  p_paid_on date
)
returns public.partner_earnings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_row public.partner_earnings%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if v_kind = 'project' then raise exception 'Partner: Record an initial 50%% or a final 50%%.'; end if;
  update public.partner_referrals set eligibility = 'eligible'
  where id = p_referral_id and eligibility = 'pending';
  perform public.admin_record_partner_payment(
    p_referral_id, v_kind, p_project_name, p_fee, p_fee, 0, p_paid_on, 'Recorded by admin', true
  );
  select * into v_row from public.partner_earnings
  where referral_id = p_referral_id and kind = v_kind
  order by created_at desc limit 1;
  return v_row;
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
  v_email text;
  v_name text;
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

  select email, full_name into v_email, v_name from public.partners where id = p_partner_id;
  perform public.partner_notice(
    p_partner_id,
    'Geeslane transferred NGN ' || trim(to_char(v_amount, 'FM999,999,990.00'))
      || ' to your registered account. Reference: ' || v_reference || '.'
  );
  perform public.partner_audit('payout_recorded', p_partner_id, null, jsonb_build_object(
    'payoutId', v_id, 'amount', v_amount, 'reference', v_reference, 'earningIds', to_jsonb(p_earning_ids)
  ));
  begin
    perform public.partner_queue_notification('payout_paid', v_id, 'partner');
    perform public.partner_queue_notification('payout_paid', v_id, 'community_manager');
  exception when undefined_function then
    null;
  end;
  return v_id;
end;
$$;

create or replace function public.admin_mark_partner_payout(
  p_earning_id uuid,
  p_payout_on date,
  p_receipt text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partner_earnings%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  select * into v_row from public.partner_earnings where id = p_earning_id;
  if v_row.id is null then raise exception 'Partner: That earning was not found.'; end if;
  perform public.admin_record_partner_payout(
    v_row.partner_id, array[p_earning_id], v_row.commission, p_payout_on, trim(p_receipt), trim(p_receipt)
  );
end;
$$;

create or replace function public.admin_set_partner_status(p_partner_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if v_status not in ('active', 'suspended') then raise exception 'Partner: Choose a partner status.'; end if;
  update public.partners set status = v_status where id = p_partner_id;
  if not found then raise exception 'Partner: That partner was not found.'; end if;
  perform public.partner_audit('partner_status', p_partner_id, null, jsonb_build_object('status', v_status));
end;
$$;

create or replace function public.admin_revoke_partner_access(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  update public.partners set access_status = 'revoked', token = v_token where id = p_partner_id;
  if not found then raise exception 'Partner: That partner was not found.'; end if;
  perform public.partner_audit('access_revoked', p_partner_id, null, '{}'::jsonb);
end;
$$;

create or replace function public.admin_regenerate_partner_token(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  update public.partners set access_status = 'active', token = v_token where id = p_partner_id;
  if not found then raise exception 'Partner: That partner was not found.'; end if;
  perform public.partner_audit('access_regenerated', p_partner_id, null, '{}'::jsonb);
  return jsonb_build_object('token', v_token);
end;
$$;

create or replace function public.admin_partner_announce(
  p_all boolean,
  p_partner_ids uuid[],
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := trim(coalesce(p_body, ''));
  v_count int;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if length(v_body) < 3 then raise exception 'Partner: Write the announcement.'; end if;
  if v_body ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' or v_body ~ '[0-9][0-9 \-]{7,}[0-9]' then
    raise exception 'Partner: Do not include a phone number or email address.';
  end if;
  if coalesce(p_all, false) then
    insert into public.partner_notices (partner_id, body, kind)
    select id, v_body, 'announcement' from public.partners;
    select count(*) into v_count from public.partners;
  else
    if p_partner_ids is null or cardinality(p_partner_ids) = 0 then
      raise exception 'Partner: Choose at least one partner.';
    end if;
    insert into public.partner_notices (partner_id, body, kind)
    select p.id, v_body, 'announcement'
    from public.partners p where p.id = any(p_partner_ids);
    get diagnostics v_count = row_count;
  end if;
  perform public.partner_audit('announcement_sent', null, null, jsonb_build_object('all', coalesce(p_all, false), 'count', v_count));
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'email', p.email))
    from public.partners p
    where coalesce(p_all, false) or p.id = any(p_partner_ids)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.admin_referral_update(p_referral_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.partner_referrals%rowtype;
  v_body text := trim(coalesce(p_body, ''));
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if length(v_body) < 3 then raise exception 'Partner: Write the update.'; end if;
  if v_body ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' or v_body ~ '[0-9][0-9 \-]{7,}[0-9]' then
    raise exception 'Partner: Do not include a phone number or email address.';
  end if;
  select * into v_row from public.partner_referrals where id = p_referral_id;
  if v_row.id is null then raise exception 'Partner: That referral was not found.'; end if;
  insert into public.partner_notices (partner_id, referral_id, body, kind)
  values (v_row.partner_id, v_row.id, v_body, 'referral');
  perform public.partner_audit('referral_update', v_row.partner_id, v_row.id, jsonb_build_object('body', left(v_body, 240)));
end;
$$;

revoke all on function public.partner_audit(text, uuid, uuid, jsonb) from public;
revoke all on function public.partner_forfeit_open(uuid) from public;
revoke all on function public.partner_project_snapshot(text) from public;
revoke all on function public.admin_partner_bank(uuid) from public;
revoke all on function public.admin_partner_record(uuid, uuid) from public;
revoke all on function public.admin_update_referral(uuid, text, text, numeric, numeric, date) from public;
revoke all on function public.admin_set_referral_eligibility(uuid, text, text) from public;
revoke all on function public.admin_cancel_referral(uuid) from public;
revoke all on function public.admin_record_partner_payment(uuid, text, text, numeric, numeric, numeric, date, text, boolean) from public;
revoke all on function public.admin_record_partner_payout(uuid, uuid[], numeric, date, text, text) from public;
revoke all on function public.admin_set_partner_status(uuid, text) from public;
revoke all on function public.admin_revoke_partner_access(uuid) from public;
revoke all on function public.admin_regenerate_partner_token(uuid) from public;
revoke all on function public.admin_partner_announce(boolean, uuid[], text) from public;
revoke all on function public.admin_referral_update(uuid, text) from public;
revoke all on function public.partner_mark_admin_notified(text) from public;
revoke all on function public.admin_mark_partner_notified(uuid) from public;

grant execute on function public.partner_mark_admin_notified(text) to anon, authenticated;
grant execute on function public.admin_mark_partner_notified(uuid) to authenticated;
grant execute on function public.admin_partner_bank(uuid) to authenticated;
grant execute on function public.admin_partner_record(uuid, uuid) to authenticated;
grant execute on function public.admin_update_referral(uuid, text, text, numeric, numeric, date) to authenticated;
grant execute on function public.admin_set_referral_eligibility(uuid, text, text) to authenticated;
grant execute on function public.admin_cancel_referral(uuid) to authenticated;
grant execute on function public.admin_record_partner_payment(uuid, text, text, numeric, numeric, numeric, date, text, boolean) to authenticated;
grant execute on function public.admin_record_partner_payout(uuid, uuid[], numeric, date, text, text) to authenticated;
grant execute on function public.admin_set_partner_status(uuid, text) to authenticated;
grant execute on function public.admin_revoke_partner_access(uuid) to authenticated;
grant execute on function public.admin_regenerate_partner_token(uuid) to authenticated;
grant execute on function public.admin_partner_announce(boolean, uuid[], text) to authenticated;
grant execute on function public.admin_referral_update(uuid, text) to authenticated;
grant execute on function public.admin_partner_board() to authenticated;
grant execute on function public.partner_board(text) to anon, authenticated;

