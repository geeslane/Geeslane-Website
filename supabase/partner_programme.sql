-- November Partner Programme (1–30 November 2026, Africa/Lagos).
-- Run once in Supabase → SQL Editor.
-- Then redeploy supabase/functions/send-portal-mail.

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  phone text not null default '',
  bank_name text not null default '',
  account_number text not null default '',
  account_name text not null default '',
  code text not null unique,
  token text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.partner_referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  registration_id uuid,
  email text not null,
  business_name text not null default '',
  service text not null default '',
  status text not null default 'requested' check (status in ('requested', 'qualified', 'excluded')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz
);

create unique index if not exists partner_referrals_email_key on public.partner_referrals (lower(email));

create table if not exists public.partner_earnings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  referral_id uuid not null references public.partner_referrals(id) on delete cascade,
  project_name text not null default '',
  kind text not null check (kind in ('first', 'second', 'project')),
  fee numeric(12, 2) not null check (fee > 0),
  commission numeric(12, 2) not null check (commission >= 0),
  client_paid_on date not null,
  payout_status text not null default 'due' check (payout_status in ('due', 'paid')),
  payout_on date,
  receipt_note text not null default '',
  created_at timestamptz not null default now(),
  unique (referral_id, kind)
);

create table if not exists public.partner_notices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

alter table public.partners enable row level security;
alter table public.partner_referrals enable row level security;
alter table public.partner_earnings enable row level security;
alter table public.partner_notices enable row level security;

revoke all on public.partners from anon, authenticated;
revoke all on public.partner_referrals from anon, authenticated;
revoke all on public.partner_earnings from anon, authenticated;
revoke all on public.partner_notices from anon, authenticated;

create or replace function public.partner_lagos_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

create or replace function public.partner_same_name(p_left text, p_right text)
returns boolean
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_left, '')), '\s+', ' ', 'g'))
    = lower(regexp_replace(trim(coalesce(p_right, '')), '\s+', ' ', 'g'))
    and length(trim(coalesce(p_left, ''))) >= 2;
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
    select sum(commission) from public.partner_earnings where referral_id = p_referral_id
  ), 0));
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

  return jsonb_build_object(
    'name', v_name,
    'email', v_email,
    'code', v_code,
    'token', v_token
  );
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
begin
  if v_code = '' or position('@' in v_email) < 2 then return; end if;
  if v_today < date '2026-11-01' or v_today > date '2026-11-30' then return; end if;
  select * into v_partner from public.partners where code = v_code;
  if v_partner.id is null then return; end if;
  if exists (select 1 from public.partner_referrals where lower(email) = v_email) then return; end if;

  insert into public.partner_referrals (partner_id, registration_id, email, business_name, service)
  values (
    v_partner.id,
    p_registration_id,
    v_email,
    trim(coalesce(p_business, '')),
    trim(coalesce(p_service, ''))
  );
  perform public.partner_notice(
    v_partner.id,
    'A request came in from ' || coalesce(nullif(trim(p_business), ''), 'a business') || '. It counts after the quote is accepted and the first payment clears in November.'
  );
exception when unique_violation then
  return;
end;
$$;

drop function if exists public.submit_portal_registration(text, text, text, text, text, text, text, date, jsonb);

create or replace function public.submit_portal_registration(
  p_name text,
  p_business text,
  p_email text,
  p_phone text,
  p_contact text,
  p_service text,
  p_description text,
  p_target_date date default null,
  p_discovery jsonb default '{}'::jsonb,
  p_partner_code text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(trim(coalesce(p_name, ''))) < 2
     or length(trim(coalesce(p_business, ''))) < 2
     or position('@' in coalesce(p_email, '')) < 2
     or length(trim(coalesce(p_service, ''))) < 2
     or length(trim(coalesce(p_description, ''))) < 5 then
    raise exception 'Please complete the required request fields';
  end if;

  if exists (select 1 from public.clients where lower(email) = lower(trim(p_email)))
     or exists (select 1 from public.profiles where lower(email) = lower(trim(p_email))) then
    raise exception 'This email already has a Geeslane portal account. Sign in instead.';
  end if;

  select id into v_id from public.registrations
  where lower(email) = lower(trim(p_email)) and status = 'Pending'
  order by created_at desc limit 1;

  if v_id is null then
    insert into public.registrations (
      email, name, business, phone, contact_preference, requested_service, project_description, target_date, discovery
    ) values (
      lower(trim(p_email)), trim(p_name), trim(p_business), trim(coalesce(p_phone, '')),
      coalesce(nullif(trim(p_contact), ''), 'Email'), trim(p_service), trim(p_description), p_target_date,
      coalesce(p_discovery, '{}'::jsonb)
    ) returning id into v_id;
  else
    update public.registrations set
      name = trim(p_name), business = trim(p_business), phone = trim(coalesce(p_phone, '')),
      contact_preference = coalesce(nullif(trim(p_contact), ''), 'Email'),
      requested_service = trim(p_service), project_description = trim(p_description),
      target_date = p_target_date, discovery = coalesce(p_discovery, '{}'::jsonb), updated_at = now()
    where id = v_id;
  end if;

  perform public.attach_partner_referral(v_id, p_email, p_business, p_service, p_partner_code);
  return v_id;
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
  v_referral public.partner_referrals%rowtype;
  v_kind text := lower(trim(coalesce(p_kind, '')));
  v_fee numeric(12, 2) := round(coalesce(p_fee, 0), 2);
  v_project text := trim(coalesce(p_project_name, ''));
  v_today date := public.partner_lagos_today();
  v_room numeric;
  v_commission numeric(12, 2);
  v_row public.partner_earnings%rowtype;
  v_label text;
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  select * into v_referral from public.partner_referrals where id = p_referral_id for update;
  if v_referral.id is null then raise exception 'Partner: That referral was not found.'; end if;
  if v_referral.status = 'excluded' then raise exception 'Partner: This person was already in conversation with Geeslane, so the referral does not count.'; end if;
  if length(v_project) < 2 then raise exception 'Partner: Enter the project name.'; end if;
  if v_fee <= 0 then raise exception 'Partner: Enter the Geeslane fee in this payment, after any discount.'; end if;
  if p_paid_on is null or p_paid_on > v_today then raise exception 'Partner: Enter the date the client payment cleared.'; end if;
  if v_kind not in ('first', 'second', 'project') then raise exception 'Partner: Choose the payment type.'; end if;

  if v_kind in ('first', 'project') then
    if v_referral.status <> 'requested' then raise exception 'Partner: This referral has already been decided.'; end if;
    if p_paid_on < date '2026-11-01' or p_paid_on > date '2026-11-30' then
      raise exception 'Partner: The first payment has to clear between 1 and 30 November 2026.';
    end if;
  else
    if v_referral.status <> 'qualified' then raise exception 'Partner: Record the accepted offer before the second payment.'; end if;
    if not exists (select 1 from public.partner_earnings where referral_id = v_referral.id and kind = 'first') then
      raise exception 'Partner: A one-off project payment does not have a second payment.';
    end if;
    if p_paid_on < date '2026-11-01' then raise exception 'Partner: Enter the date the client payment cleared.'; end if;
  end if;

  if exists (select 1 from public.partner_earnings where referral_id = v_referral.id and kind = v_kind) then
    raise exception 'Partner: That payment is already recorded.';
  end if;
  if v_kind = 'project' and exists (select 1 from public.partner_earnings where referral_id = v_referral.id and kind = 'first') then
    raise exception 'Partner: This project already has a first payment.';
  end if;
  if v_kind = 'first' and exists (select 1 from public.partner_earnings where referral_id = v_referral.id and kind = 'project') then
    raise exception 'Partner: This project was recorded as a one-off payment.';
  end if;

  v_room := public.partner_room(v_referral.id);
  v_commission := least(round(v_fee * 0.2, 2), v_room);
  if v_commission <= 0 then raise exception 'Partner: This project has reached the N100,000 cap.'; end if;

  insert into public.partner_earnings (partner_id, referral_id, project_name, kind, fee, commission, client_paid_on)
  values (v_referral.partner_id, v_referral.id, v_project, v_kind, v_fee, v_commission, p_paid_on)
  returning * into v_row;

  if v_kind in ('first', 'project') then
    update public.partner_referrals set status = 'qualified', qualified_at = now(), business_name = coalesce(nullif(v_referral.business_name, ''), v_referral.business_name)
    where id = v_referral.id;
  end if;

  v_label := case v_kind when 'first' then 'First payment' when 'second' then 'Second payment' else 'Project payment' end;
  perform public.partner_notice(
    v_referral.partner_id,
    v_referral.business_name || ' — ' || v_label || ' cleared. Your amount is N' || trim(to_char(v_commission, 'FM999,999,990.00')) || ' on the Geeslane fee of N' || trim(to_char(v_fee, 'FM999,999,990.00')) || '.'
  );
  return v_row;
end;
$$;

create or replace function public.admin_exclude_referral(p_referral_id uuid)
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
  if v_row.status <> 'requested' then raise exception 'Partner: This referral has already been decided.'; end if;
  update public.partner_referrals set status = 'excluded' where id = v_row.id;
  perform public.partner_notice(v_row.partner_id, v_row.business_name || ' does not count. Geeslane was already speaking with them.');
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
  v_business text;
  v_label text;
  v_today date := public.partner_lagos_today();
begin
  if not public.is_portal_admin() then raise exception 'Partner: Administrator access is required.'; end if;
  if p_payout_on is null or p_payout_on > v_today then raise exception 'Partner: Enter the date you transferred the money.'; end if;
  if length(trim(coalesce(p_receipt, ''))) < 3 then raise exception 'Partner: Add a receipt note or transfer reference.'; end if;
  select * into v_row from public.partner_earnings where id = p_earning_id for update;
  if v_row.id is null then raise exception 'Partner: That earning was not found.'; end if;
  if v_row.payout_status = 'paid' then raise exception 'Partner: This transfer is already recorded.'; end if;
  update public.partner_earnings set payout_status = 'paid', payout_on = p_payout_on, receipt_note = trim(p_receipt) where id = v_row.id;
  select business_name into v_business from public.partner_referrals where id = v_row.referral_id;
  v_label := case v_row.kind when 'first' then 'First payment' when 'second' then 'Second payment' else 'Project payment' end;
  perform public.partner_notice(
    v_row.partner_id,
    'Geeslane transferred N' || trim(to_char(v_row.commission, 'FM999,999,990.00')) || ' for ' || coalesce(v_business, 'a project') || ' (' || v_label || '). Receipt: ' || trim(p_receipt)
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
    'partners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.full_name, 'email', p.email, 'phone', p.phone,
        'bankName', p.bank_name, 'accountNumber', p.account_number, 'accountName', p.account_name,
        'code', p.code, 'token', p.token, 'createdAt', p.created_at
      ) order by p.created_at desc)
      from public.partners p
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'partnerId', r.partner_id, 'partnerName', p.full_name, 'code', p.code,
        'business', r.business_name, 'service', r.service, 'email', r.email,
        'status', r.status, 'createdAt', r.created_at, 'qualifiedAt', r.qualified_at
      ) order by r.created_at desc)
      from public.partner_referrals r
      join public.partners p on p.id = r.partner_id
    ), '[]'::jsonb),
    'earnings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'referralId', e.referral_id, 'partnerId', e.partner_id,
        'partnerName', p.full_name, 'business', r.business_name,
        'project', e.project_name, 'kind', e.kind, 'fee', e.fee, 'commission', e.commission,
        'clientPaidOn', e.client_paid_on, 'payoutStatus', e.payout_status,
        'payoutOn', e.payout_on, 'receipt', e.receipt_note
      ) order by e.created_at desc)
      from public.partner_earnings e
      join public.partner_referrals r on r.id = e.referral_id
      join public.partners p on p.id = e.partner_id
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
  if v_partner.id is null then raise exception 'Partner: This partner link is not valid. Open the link in your welcome email.'; end if;
  return jsonb_build_object(
    'name', v_partner.full_name,
    'code', v_partner.code,
    'notices', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'createdAt', n.created_at, 'read', n.read_at is not null) order by n.created_at desc)
      from public.partner_notices n where n.partner_id = v_partner.id
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'business', r.business_name, 'service', r.service, 'status', r.status, 'createdAt', r.created_at,
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

create or replace function public.partner_mark_notices_read(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.partners where token = trim(coalesce(p_token, ''));
  if v_id is null then return; end if;
  update public.partner_notices set read_at = now() where partner_id = v_id and read_at is null;
end;
$$;

revoke all on function public.partner_lagos_today() from public;
revoke all on function public.partner_same_name(text, text) from public;
revoke all on function public.partner_notice(uuid, text) from public;
revoke all on function public.partner_room(uuid) from public;
revoke all on function public.attach_partner_referral(uuid, text, text, text, text) from public;
revoke all on function public.partner_add_earning(uuid, text, text, numeric, date) from public;
revoke all on function public.register_partner(text, text, text, text, text, text, boolean, boolean) from public;
revoke all on function public.submit_portal_registration(text, text, text, text, text, text, text, date, jsonb, text) from public;
revoke all on function public.admin_exclude_referral(uuid) from public;
revoke all on function public.admin_mark_partner_payout(uuid, date, text) from public;
revoke all on function public.admin_partner_board() from public;
revoke all on function public.partner_board(text) from public;
revoke all on function public.partner_mark_notices_read(text) from public;

grant execute on function public.register_partner(text, text, text, text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.submit_portal_registration(text, text, text, text, text, text, text, date, jsonb, text) to anon, authenticated;
grant execute on function public.partner_board(text) to anon, authenticated;
grant execute on function public.partner_mark_notices_read(text) to anon, authenticated;
grant execute on function public.partner_add_earning(uuid, text, text, numeric, date) to authenticated;
grant execute on function public.admin_exclude_referral(uuid) to authenticated;
grant execute on function public.admin_mark_partner_payout(uuid, date, text) to authenticated;
grant execute on function public.admin_partner_board() to authenticated;
