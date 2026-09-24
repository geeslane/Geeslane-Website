-- OPTIONAL. Do not run this until you want a clean test workspace.
-- Paste into Supabase → SQL Editor only when you are ready.
-- This file does nothing by sitting in the repo.
--
-- Keeps:
--   - administrator profiles (role = 'admin')
--   - portal_settings (bank details, payment flags)
--
-- Removes portal test data: projects, invoices, receipts, clients, registrations,
-- requests, files metadata, and non-admin profiles.
--
-- After this SQL:
--   1. Storage → Buckets → project-files → delete leftover objects
--   2. Authentication → Users → remove test client users only (keep your admin user)

begin;

delete from public.milestone_messages;
delete from public.activity;
delete from public.portal_requests;
delete from public.project_receipts;
delete from public.project_invoices;
delete from public.project_agreements;
delete from public.assets;
delete from public.milestones;
delete from public.brand_kits;
delete from public.project_content;
delete from public.projects;
delete from public.registrations;
delete from public.clients;
delete from public.profiles
where lower(coalesce(role, '')) is distinct from 'admin';

commit;
