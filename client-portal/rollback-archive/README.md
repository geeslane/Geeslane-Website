# Rollback archive — Google Apps Script

These files are **not** part of the live Geeslane Client Portal.

The production path is Supabase Auth, Postgres with Row Level Security, and Supabase Storage.
Keep these snippets only if you need to recover an older Sheets / Apps Script experiment.

Do not:

- Deploy these scripts as the live portal backend
- Put Apps Script web app URLs back into `config.js`
- Mix Apps Script authentication with Supabase Auth

Live email delivery for magic links is configured with Resend Custom SMTP in the Supabase dashboard. See `../DEPLOYMENT.md`.
