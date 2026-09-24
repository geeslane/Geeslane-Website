-- Active projects + invoices / payment tracking.
-- Run in Supabase → SQL Editor after the base portal schema.

alter table public.projects
  add column if not exists is_active boolean not null default true;

create table if not exists public.project_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  reference text not null unique,
  title text not null default '',
  description text not null default '',
  amount text not null default '',
  currency text not null default 'NGN',
  due_date date,
  status text not null default 'Draft',
  paid_amount text not null default '',
  notes text not null default '',
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_invoices_status_check check (status in ('Draft', 'Sent', 'Part paid', 'Paid', 'Overdue', 'Cancelled'))
);

create index if not exists project_invoices_project_idx on public.project_invoices (project_id, created_at desc);

alter table public.project_invoices enable row level security;

drop policy if exists project_invoices_read on public.project_invoices;
create policy project_invoices_read on public.project_invoices
  for select to authenticated
  using (public.can_access_project(project_id));

revoke all on public.project_invoices from anon, authenticated;
grant select on public.project_invoices to authenticated;

create or replace function public.admin_set_project_active(p_project_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  update public.projects set is_active = coalesce(p_is_active, true), updated_at = now() where id = p_project_id;
  if not found then raise exception 'Project not found'; end if;
end;
$$;

create or replace function public.next_invoice_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_count integer;
begin
  select count(*) + 1 into v_count from public.project_invoices where reference like 'INV-' || v_year || '-%';
  return 'INV-' || v_year || '-' || lpad(v_count::text, 4, '0');
end;
$$;

create or replace function public.admin_save_invoice(p_project_id uuid, p_invoice jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
  v_row public.project_invoices%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id) then raise exception 'Project not found'; end if;
  v_status := coalesce(nullif(trim(p_invoice->>'status'), ''), 'Draft');
  if v_status not in ('Draft', 'Sent', 'Part paid', 'Paid', 'Overdue', 'Cancelled') then v_status := 'Draft'; end if;
  v_id := nullif(p_invoice->>'id', '')::uuid;

  if v_id is null then
    insert into public.project_invoices (
      project_id, reference, title, description, amount, currency, due_date, status, paid_amount, notes, sent_at, paid_at, updated_at
    ) values (
      p_project_id,
      coalesce(nullif(trim(p_invoice->>'reference'), ''), public.next_invoice_reference()),
      trim(coalesce(p_invoice->>'title', '')),
      trim(coalesce(p_invoice->>'description', '')),
      trim(coalesce(p_invoice->>'amount', '')),
      coalesce(nullif(trim(p_invoice->>'currency'), ''), 'NGN'),
      nullif(p_invoice->>'dueDate', '')::date,
      v_status,
      trim(coalesce(p_invoice->>'paidAmount', '')),
      trim(coalesce(p_invoice->>'notes', '')),
      case when v_status in ('Sent', 'Part paid', 'Paid', 'Overdue') then now() else null end,
      case when v_status = 'Paid' then now() else null end,
      now()
    ) returning * into v_row;
  else
    update public.project_invoices set
      title = trim(coalesce(p_invoice->>'title', title)),
      description = trim(coalesce(p_invoice->>'description', description)),
      amount = trim(coalesce(p_invoice->>'amount', amount)),
      currency = coalesce(nullif(trim(p_invoice->>'currency'), ''), currency),
      due_date = coalesce(nullif(p_invoice->>'dueDate', '')::date, due_date),
      status = v_status,
      paid_amount = trim(coalesce(p_invoice->>'paidAmount', paid_amount)),
      notes = trim(coalesce(p_invoice->>'notes', notes)),
      sent_at = case when v_status in ('Sent', 'Part paid', 'Paid', 'Overdue') then coalesce(sent_at, now()) else sent_at end,
      paid_at = case when v_status = 'Paid' then coalesce(paid_at, now()) when v_status in ('Draft', 'Cancelled') then null else paid_at end,
      updated_at = now()
    where id = v_id and project_id = p_project_id
    returning * into v_row;
    if v_row.id is null then raise exception 'Invoice not found'; end if;
  end if;

  insert into public.activity (project_id, title, detail, type)
  values (p_project_id, 'Invoice updated', coalesce(nullif(v_row.reference, ''), 'Invoice') || ' is ' || v_row.status, 'request');

  return jsonb_build_object(
    'id', v_row.id, 'projectId', v_row.project_id, 'reference', v_row.reference, 'title', v_row.title,
    'description', v_row.description, 'amount', v_row.amount, 'currency', v_row.currency, 'dueDate', v_row.due_date,
    'status', v_row.status, 'paidAmount', v_row.paid_amount, 'notes', v_row.notes, 'sentAt', v_row.sent_at,
    'paidAt', v_row.paid_at, 'createdAt', v_row.created_at, 'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.track_project_invoice(p_reference text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.project_invoices%rowtype;
  v_project public.projects%rowtype;
  v_client public.clients%rowtype;
begin
  if position('@' in coalesce(p_email, '')) < 2 or length(trim(coalesce(p_reference, ''))) < 4 then
    raise exception 'Enter the invoice number and the email used on the project';
  end if;
  select * into v_row from public.project_invoices where lower(reference) = lower(trim(p_reference));
  if v_row.id is null then raise exception 'No invoice matches those details'; end if;
  select * into v_project from public.projects where id = v_row.project_id;
  select * into v_client from public.clients where id = v_project.client_id;
  if v_client.id is null or lower(v_client.email) <> lower(trim(p_email)) then
    raise exception 'No invoice matches those details';
  end if;
  return jsonb_build_object(
    'reference', v_row.reference,
    'title', v_row.title,
    'amount', v_row.amount,
    'currency', v_row.currency,
    'dueDate', v_row.due_date,
    'status', v_row.status,
    'paidAmount', v_row.paid_amount,
    'paidAt', v_row.paid_at,
    'projectName', v_project.name,
    'business', v_client.business
  );
end;
$$;

revoke execute on function public.admin_set_project_active(uuid, boolean) from public;
revoke execute on function public.next_invoice_reference() from public;
revoke execute on function public.admin_save_invoice(uuid, jsonb) from public;
revoke execute on function public.track_project_invoice(text, text) from public;

grant execute on function public.admin_set_project_active(uuid, boolean) to authenticated;
grant execute on function public.next_invoice_reference() to authenticated;
grant execute on function public.admin_save_invoice(uuid, jsonb) to authenticated;
grant execute on function public.track_project_invoice(text, text) to anon, authenticated;

create or replace function public.admin_add_project(
  p_client_id uuid,
  p_name text,
  p_service text default 'Website project',
  p_target_date date default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_row public.projects%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.clients where id = p_client_id) then raise exception 'Client not found'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Enter a project name'; end if;
  v_project_id := public.seed_portal_project(p_client_id, trim(p_name), coalesce(nullif(trim(p_service), ''), 'Website project'), p_target_date);
  update public.projects set is_active = coalesce(p_is_active, true), updated_at = now() where id = v_project_id returning * into v_row;
  return jsonb_build_object(
    'id', v_row.id, 'clientId', v_row.client_id, 'name', v_row.name, 'service', v_row.service,
    'status', v_row.status, 'stage', v_row.stage, 'progress', v_row.progress,
    'startDate', v_row.start_date, 'targetDate', v_row.target_date, 'isActive', v_row.is_active
  );
end;
$$;

revoke execute on function public.admin_add_project(uuid, text, text, date, boolean) from public;
grant execute on function public.admin_add_project(uuid, text, text, date, boolean) to authenticated;

create table if not exists public.project_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  invoice_id uuid references public.project_invoices(id) on delete set null,
  reference text not null unique,
  title text not null default '',
  description text not null default '',
  amount text not null default '',
  currency text not null default 'NGN',
  paid_on date,
  method text not null default '',
  notes text not null default '',
  status text not null default 'Draft',
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_receipts_status_check check (status in ('Draft', 'Issued', 'Cancelled'))
);

create index if not exists project_receipts_project_idx on public.project_receipts (project_id, created_at desc);

alter table public.project_receipts enable row level security;

drop policy if exists project_receipts_read on public.project_receipts;
create policy project_receipts_read on public.project_receipts
  for select to authenticated
  using (public.can_access_project(project_id));

revoke all on public.project_receipts from anon, authenticated;
grant select on public.project_receipts to authenticated;

create or replace function public.next_receipt_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_count integer;
begin
  select count(*) + 1 into v_count from public.project_receipts where reference like 'RCP-' || v_year || '-%';
  return 'RCP-' || v_year || '-' || lpad(v_count::text, 4, '0');
end;
$$;

create or replace function public.admin_save_receipt(p_project_id uuid, p_receipt jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_status text;
  v_invoice uuid;
  v_paid date;
  v_row public.project_receipts%rowtype;
  v_invoice_ref text := '';
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  if not exists (select 1 from public.projects where id = p_project_id) then raise exception 'Project not found'; end if;
  v_status := coalesce(nullif(trim(p_receipt->>'status'), ''), 'Draft');
  if v_status not in ('Draft', 'Issued', 'Cancelled') then v_status := 'Draft'; end if;
  v_id := nullif(p_receipt->>'id', '')::uuid;
  begin
    v_invoice := nullif(trim(p_receipt->>'invoiceId'), '')::uuid;
  exception when others then
    v_invoice := null;
  end;
  if v_invoice is not null and not exists (select 1 from public.project_invoices where id = v_invoice and project_id = p_project_id) then
    v_invoice := null;
  end if;

  begin
    v_paid := nullif(trim(p_receipt->>'paidOn'), '')::date;
  exception when others then
    v_paid := null;
  end;

  if v_id is null then
    insert into public.project_receipts (
      project_id, invoice_id, reference, title, description, amount, currency, paid_on, method, notes, status, sent_at, updated_at
    ) values (
      p_project_id,
      v_invoice,
      coalesce(nullif(trim(p_receipt->>'reference'), ''), public.next_receipt_reference()),
      trim(coalesce(p_receipt->>'title', '')),
      trim(coalesce(p_receipt->>'description', '')),
      trim(coalesce(p_receipt->>'amount', '')),
      coalesce(nullif(trim(p_receipt->>'currency'), ''), 'NGN'),
      coalesce(v_paid, current_date),
      trim(coalesce(p_receipt->>'method', '')),
      trim(coalesce(p_receipt->>'notes', '')),
      v_status,
      case when v_status = 'Issued' then now() else null end,
      now()
    ) returning * into v_row;
  else
    update public.project_receipts set
      invoice_id = v_invoice,
      title = trim(coalesce(p_receipt->>'title', title)),
      description = trim(coalesce(p_receipt->>'description', description)),
      amount = trim(coalesce(p_receipt->>'amount', amount)),
      currency = coalesce(nullif(trim(p_receipt->>'currency'), ''), currency),
      paid_on = coalesce(v_paid, paid_on),
      method = trim(coalesce(p_receipt->>'method', method)),
      notes = trim(coalesce(p_receipt->>'notes', notes)),
      status = v_status,
      sent_at = case when v_status = 'Issued' then coalesce(sent_at, now()) else sent_at end,
      updated_at = now()
    where id = v_id and project_id = p_project_id
    returning * into v_row;
    if v_row.id is null then raise exception 'Receipt not found'; end if;
  end if;

  if v_row.invoice_id is not null then
    select reference into v_invoice_ref from public.project_invoices where id = v_row.invoice_id;
  end if;

  insert into public.activity (project_id, title, detail, type)
  values (p_project_id, 'Receipt updated', coalesce(nullif(v_row.reference, ''), 'Receipt') || ' is ' || v_row.status, 'request');

  return jsonb_build_object(
    'id', v_row.id, 'projectId', v_row.project_id, 'invoiceId', v_row.invoice_id, 'invoiceReference', v_invoice_ref,
    'reference', v_row.reference, 'title', v_row.title, 'description', v_row.description, 'amount', v_row.amount,
    'currency', v_row.currency, 'paidOn', v_row.paid_on, 'method', v_row.method, 'notes', v_row.notes,
    'status', v_row.status, 'sentAt', v_row.sent_at, 'createdAt', v_row.created_at, 'updatedAt', v_row.updated_at
  );
end;
$$;

create or replace function public.track_project_invoice(p_reference text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.project_invoices%rowtype;
  v_receipt public.project_receipts%rowtype;
  v_project public.projects%rowtype;
  v_client public.clients%rowtype;
  v_invoice_ref text := '';
begin
  if position('@' in coalesce(p_email, '')) < 2 or length(trim(coalesce(p_reference, ''))) < 4 then
    raise exception 'Enter the invoice or receipt number and the email used on the project';
  end if;

  select * into v_invoice from public.project_invoices where lower(reference) = lower(trim(p_reference));
  if v_invoice.id is not null then
    select * into v_project from public.projects where id = v_invoice.project_id;
    select * into v_client from public.clients where id = v_project.client_id;
    if v_client.id is null or lower(v_client.email) <> lower(trim(p_email)) then
      raise exception 'No payment matches those details';
    end if;
    return jsonb_build_object(
      'kind', 'invoice',
      'reference', v_invoice.reference,
      'title', v_invoice.title,
      'amount', v_invoice.amount,
      'currency', v_invoice.currency,
      'dueDate', v_invoice.due_date,
      'status', v_invoice.status,
      'paidAmount', v_invoice.paid_amount,
      'paidAt', v_invoice.paid_at,
      'projectName', v_project.name,
      'business', v_client.business
    );
  end if;

  select * into v_receipt from public.project_receipts where lower(reference) = lower(trim(p_reference));
  if v_receipt.id is null then raise exception 'No payment matches those details'; end if;
  select * into v_project from public.projects where id = v_receipt.project_id;
  select * into v_client from public.clients where id = v_project.client_id;
  if v_client.id is null or lower(v_client.email) <> lower(trim(p_email)) then
    raise exception 'No payment matches those details';
  end if;
  if v_receipt.invoice_id is not null then
    select reference into v_invoice_ref from public.project_invoices where id = v_receipt.invoice_id;
  end if;
  return jsonb_build_object(
    'kind', 'receipt',
    'reference', v_receipt.reference,
    'title', v_receipt.title,
    'amount', v_receipt.amount,
    'currency', v_receipt.currency,
    'status', v_receipt.status,
    'paidOn', v_receipt.paid_on,
    'method', v_receipt.method,
    'invoiceReference', v_invoice_ref,
    'projectName', v_project.name,
    'business', v_client.business
  );
end;
$$;

revoke execute on function public.next_receipt_reference() from public;
revoke execute on function public.admin_save_receipt(uuid, jsonb) from public;

grant execute on function public.next_receipt_reference() to authenticated;
grant execute on function public.admin_save_receipt(uuid, jsonb) to authenticated;
