-- Project totals (paid / remaining) and automatic receipts after online payment.
-- Run in Supabase → SQL Editor after projects_invoices.sql.

alter table public.projects
  add column if not exists contract_amount text not null default '',
  add column if not exists contract_currency text not null default 'NGN',
  add column if not exists show_payment_summary boolean not null default true,
  add column if not exists online_payments boolean not null default true;

alter table public.project_receipts
  add column if not exists paystack_reference text;

create unique index if not exists project_receipts_paystack_ref_idx
  on public.project_receipts (paystack_reference)
  where paystack_reference is not null and length(trim(paystack_reference)) > 0;

create or replace function public.money_amount(p_value text)
returns numeric
language plpgsql
immutable
as $$
declare
  v_text text;
begin
  v_text := regexp_replace(coalesce(p_value, ''), '[^0-9.-]', '', 'g');
  if v_text is null or v_text in ('', '-', '.', '-.') then return 0; end if;
  begin
    return v_text::numeric;
  exception when others then
    return 0;
  end;
end;
$$;

create or replace function public.sync_invoice_from_receipts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_paid numeric := 0;
  v_total numeric := 0;
begin
  v_invoice_id := coalesce(new.invoice_id, old.invoice_id);
  if v_invoice_id is null then return coalesce(new, old); end if;

  select coalesce(sum(public.money_amount(amount)), 0) into v_paid
  from public.project_receipts
  where invoice_id = v_invoice_id and status = 'Issued';

  select public.money_amount(amount) into v_total
  from public.project_invoices
  where id = v_invoice_id;

  update public.project_invoices set
    paid_amount = trim(to_char(round(v_paid), 'FM9999999990')),
    status = case
      when status in ('Draft', 'Cancelled') then status
      when v_total > 0 and v_paid >= v_total then 'Paid'
      when v_paid > 0 then 'Part paid'
      when status = 'Paid' then 'Sent'
      else status
    end,
    paid_at = case
      when v_total > 0 and v_paid >= v_total then coalesce(paid_at, now())
      else paid_at
    end,
    updated_at = now()
  where id = v_invoice_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists project_receipts_sync_invoice on public.project_receipts;
create trigger project_receipts_sync_invoice
after insert or update of amount, status, invoice_id or delete
on public.project_receipts
for each row execute procedure public.sync_invoice_from_receipts();

create or replace function public.admin_set_project_billing(
  p_project_id uuid,
  p_contract_amount text default '',
  p_contract_currency text default 'NGN',
  p_show_payment_summary boolean default true,
  p_online_payments boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.projects%rowtype;
begin
  if not public.is_portal_admin() then raise exception 'Administrator access required'; end if;
  update public.projects set
    contract_amount = trim(coalesce(p_contract_amount, '')),
    contract_currency = coalesce(nullif(trim(p_contract_currency), ''), 'NGN'),
    show_payment_summary = coalesce(p_show_payment_summary, true),
    online_payments = coalesce(p_online_payments, true),
    updated_at = now()
  where id = p_project_id
  returning * into v_row;
  if v_row.id is null then raise exception 'Project not found'; end if;
  return jsonb_build_object(
    'id', v_row.id,
    'contractAmount', v_row.contract_amount,
    'contractCurrency', v_row.contract_currency,
    'showPaymentSummary', v_row.show_payment_summary,
    'onlinePayments', v_row.online_payments
  );
end;
$$;

create or replace function public.record_online_payment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ref text;
  v_invoice uuid;
  v_project uuid;
  v_row public.project_receipts%rowtype;
  v_invoice_row public.project_invoices%rowtype;
  v_invoice_ref text := '';
begin
  v_ref := trim(coalesce(p_payload->>'paystackReference', ''));
  v_project := nullif(trim(coalesce(p_payload->>'projectId', '')), '')::uuid;
  begin
    v_invoice := nullif(trim(coalesce(p_payload->>'invoiceId', '')), '')::uuid;
  exception when others then
    v_invoice := null;
  end;
  if length(v_ref) < 6 then raise exception 'Missing payment reference'; end if;
  if v_project is null then raise exception 'Missing project'; end if;

  select * into v_row from public.project_receipts where paystack_reference = v_ref;
  if v_row.id is not null then
    if v_row.invoice_id is not null then
      select reference into v_invoice_ref from public.project_invoices where id = v_row.invoice_id;
    end if;
    return jsonb_build_object(
      'id', v_row.id, 'projectId', v_row.project_id, 'invoiceId', v_row.invoice_id, 'invoiceReference', v_invoice_ref,
      'reference', v_row.reference, 'title', v_row.title, 'description', v_row.description, 'amount', v_row.amount,
      'currency', v_row.currency, 'paidOn', v_row.paid_on, 'method', v_row.method, 'notes', v_row.notes,
      'status', v_row.status, 'paystackReference', v_row.paystack_reference, 'created', false
    );
  end if;

  if v_invoice is not null then
    select * into v_invoice_row from public.project_invoices where id = v_invoice and project_id = v_project;
    if v_invoice_row.id is null then v_invoice := null; else v_invoice_ref := v_invoice_row.reference; end if;
  end if;

  insert into public.project_receipts (
    project_id, invoice_id, reference, title, description, amount, currency, paid_on, method, notes, status, sent_at, paystack_reference, updated_at
  ) values (
    v_project,
    v_invoice,
    coalesce(nullif(trim(p_payload->>'receiptReference'), ''), public.next_receipt_reference()),
    coalesce(nullif(trim(p_payload->>'title'), ''), 'Online payment'),
    trim(coalesce(p_payload->>'description', '')),
    trim(coalesce(p_payload->>'amount', '')),
    coalesce(nullif(trim(p_payload->>'currency'), ''), 'NGN'),
    coalesce(nullif(trim(p_payload->>'paidOn'), '')::date, current_date),
    coalesce(nullif(trim(p_payload->>'method'), ''), 'Card / Paystack'),
    trim(coalesce(p_payload->>'notes', '')),
    'Issued',
    now(),
    v_ref,
    now()
  ) returning * into v_row;

  insert into public.activity (project_id, title, detail, type)
  values (v_project, 'Payment received', coalesce(nullif(v_row.reference, ''), 'Receipt') || ' recorded from online payment', 'request');

  return jsonb_build_object(
    'id', v_row.id, 'projectId', v_row.project_id, 'invoiceId', v_row.invoice_id, 'invoiceReference', v_invoice_ref,
    'reference', v_row.reference, 'title', v_row.title, 'description', v_row.description, 'amount', v_row.amount,
    'currency', v_row.currency, 'paidOn', v_row.paid_on, 'method', v_row.method, 'notes', v_row.notes,
    'status', v_row.status, 'paystackReference', v_row.paystack_reference, 'created', true
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
    raise exception 'Enter the invoice number and the email used on the project';
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
      'id', v_invoice.id,
      'projectId', v_invoice.project_id,
      'reference', v_invoice.reference,
      'title', v_invoice.title,
      'amount', v_invoice.amount,
      'currency', v_invoice.currency,
      'dueDate', v_invoice.due_date,
      'status', v_invoice.status,
      'paidAmount', v_invoice.paid_amount,
      'paidAt', v_invoice.paid_at,
      'notes', v_invoice.notes,
      'projectName', v_project.name,
      'business', v_client.business,
      'onlinePayments', v_project.online_payments
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
    'id', v_receipt.id,
    'projectId', v_receipt.project_id,
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

revoke execute on function public.admin_set_project_billing(uuid, text, text, boolean, boolean) from public;
revoke execute on function public.record_online_payment(jsonb) from public;
revoke execute on function public.money_amount(text) from public;

grant execute on function public.admin_set_project_billing(uuid, text, text, boolean, boolean) to authenticated;
grant execute on function public.record_online_payment(jsonb) to service_role;
grant execute on function public.track_project_invoice(text, text) to anon, authenticated;
