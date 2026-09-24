# Geeslane Client Portal deployment

This portal uses **Supabase Auth**, **Row Level Security**, and **Supabase Storage**.
Google Apps Script is not part of the live path. Older Apps Script snippets are kept only as a labelled rollback archive.

## Never put Resend credentials in the static website

Resend / SMTP secrets must never appear in:

- `config.js`, `api.js`, HTML, or CSS
- `.env` or `.env.example` in this folder
- Git, screenshots of the repo, or documentation examples

Custom SMTP is configured **only** in the Supabase dashboard. The browser only uses the public project URL and publishable key.

## Public environment values

This is a static site. Hosting dashboard variables and `client-portal/.env` are **not** available on production (`.env` is gitignored and `https://geeslane.com/client-portal/.env` returns 404).

Put the public Supabase project URL and publishable key in `client-portal/config.js`, then deploy that file. Those two values are meant for the browser. Never add a service-role key, Resend API key, SMTP password, or SMS token there.

Locally, copy `.env.example` to `.env` in `client-portal/` for overrides and the admin password shortcut:

```
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPPORT_EMAIL=contact@geeslane.com
```

Use the project URL (`https://YOUR-PROJECT.supabase.co`), not the `/rest/v1/` endpoint.

## Configure Resend Custom SMTP

Complete this in **Supabase → Project Settings → Authentication → SMTP Settings** (or **Authentication → Emails → SMTP**).

1. In Resend, add and verify the sending domain for `auth.geeslane.com` (or the parent `geeslane.com` if that is how the mailbox is hosted).
2. Add the DNS records Resend shows for the domain (typically SPF, DKIM, and optionally DMARC). Wait until Resend marks the domain as verified.
3. Create a Resend API key in the Resend dashboard. Do not paste it into this website.
4. In Supabase, enable custom SMTP and enter:

   | Field | Value |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | `RESEND_API_KEY_ENTERED_ONLY_IN_SUPABASE` |
   | Sender name | `Geeslane Client Portal` |
   | Sender email | `no-reply@auth.geeslane.com` |

5. Save SMTP settings in Supabase. Do not copy the password into `config.js`, `.env`, Git, or this file.
6. Open **Authentication → Email Templates** and paste the HTML from `email-templates/`:
   - Magic Link → `email-templates/magic-link.html`
   - Confirm signup → `email-templates/confirm-signup.html`
   - Invite user → `email-templates/invite-user.html`
7. Set the Site URL and Redirect URLs (next section).
8. Set the OTP to 6 digits: **Authentication → Sign In / Providers → Email → Email OTP length → 6**. Save. New emails will then match the six boxes on the portal. The HTML template cannot shorten `{{ .Token }}`; that length is this setting.

### Domain verification

- The From address must match a domain you verified in Resend.
- `no-reply@auth.geeslane.com` requires `auth.geeslane.com` (or a verified parent domain that is allowed to send for that mailbox).
- Until the domain is verified, Resend will reject mail and magic links will not arrive.

## Redirect URLs

In **Supabase → Authentication → URL Configuration**:

**Site URL**

- Production: `https://geeslane.com/client-portal/`

**Redirect URLs** (add all of these):

- `http://localhost:4173/`
- `http://localhost:4173/?next=payments`
- `http://localhost:4173/admin.html`
- `http://localhost:4173/client-portal/`
- `http://localhost:4173/client-portal/?next=payments`
- `http://localhost:4173/client-portal/admin.html`
- `https://geeslane.com/client-portal/`
- `https://geeslane.com/client-portal/?next=payments`
- `https://geeslane.com/client-portal/admin.html`
- `https://geeslane.com/client-portal/**`

The portal builds `emailRedirectTo` from the current origin and path:

- Serving the portal as the site root locally → `http://localhost:4173/` and `http://localhost:4173/admin.html`
- Serving the marketing site with the portal under `/client-portal/` → `…/client-portal/` and `…/client-portal/admin.html`
- Production → `https://geeslane.com/client-portal/` and `https://geeslane.com/client-portal/admin.html`

## Test client and admin sign-in

1. Serve the site over HTTP (not `file://`). Example from the website root: `python -m http.server 4173`.
2. Open the client sign-in page, enter an approved email, and send a code. Confirm the button shows a sending state, then the 6-digit code screen.
3. Open the email from `Geeslane Client Portal <no-reply@auth.geeslane.com>`. Enter the code on the page you left open (or use the backup button).
4. Confirm the browser opens the client portal and stays signed in after a refresh or new tab.
5. Open `/admin.html`. Sign in with username and password, or send a 6-digit code. Confirm a refresh keeps the admin session.
6. Confirm only a profile with `role = "admin"` and `status = "active"` can open the admin dashboard. Other signed-in users are sent to the client portal.

If Supabase returns an email rate-limit error, the UI shows a wait message instead of the raw error. After changing `email-templates/magic-link.html`, paste it again into **Authentication → Email Templates → Magic Link**.

## Portal update emails (Resend)

Supabase Custom SMTP only sends **Auth** mail (magic links, invites, confirmations). Brand & Content, requests, and milestone notes use the `send-portal-mail` Edge Function.

Do this once. Do not put the Resend API key in the website, `.env`, or Git.

### 1. Confirm the sending domain in Resend

1. Open [resend.com](https://resend.com) and sign in.
2. Open **Domains**. `auth.geeslane.com` (or `geeslane.com`) must show as **Verified**.
3. If it is not verified, add the DNS records Resend shows and wait until the status is verified.

### 2. Create a Resend API key

1. In Resend open **API Keys** → **Create API Key**.
2. Name it `Geeslane portal mail`.
3. Permission: **Sending access**.
4. Copy the key once. You will paste it only into Supabase secrets in the next step.

### 3. Add secrets in Supabase

1. Open the project: [supabase.com/dashboard/project/xostzntvowmdjlwpsevq](https://supabase.com/dashboard/project/xostzntvowmdjlwpsevq).
2. Go to **Project Settings** → **Edge Functions** → **Secrets** (or **Project Settings** → **Secrets**).
3. Add these three secrets, then save:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | the key from step 2 |
| `NOTIFY_TEAM_EMAIL` | `contact@geeslane.com` |
| `MAIL_FROM` | `Geeslane <no-reply@auth.geeslane.com>` |

`MAIL_FROM` must use a mailbox on the verified Resend domain. If `auth.geeslane.com` is not verified, use an address on the domain that is, for example `Geeslane <contact@geeslane.com>`.

### 4. Deploy the function

**Option A — Dashboard (no CLI)**

1. In Supabase open **Edge Functions**.
2. **Create a new function**.
3. Name it exactly `send-portal-mail`.
4. Replace the editor contents with `supabase/functions/send-portal-mail/index.ts` from this repo.
5. Deploy.

Redeploy this function whenever `supabase/functions/send-portal-mail/index.ts` changes. Service-request emails (logo, full answers, and the client confirmation) need the latest version.

**Option B — CLI**

From the website root (`GeeslaneWebsite`):

```
npx supabase login
npx supabase link --project-ref xostzntvowmdjlwpsevq
npx supabase secrets set RESEND_API_KEY=YOUR_RESEND_KEY
npx supabase secrets set NOTIFY_TEAM_EMAIL=contact@geeslane.com
npx supabase secrets set MAIL_FROM="Geeslane <no-reply@auth.geeslane.com>"
npx supabase functions deploy send-portal-mail
```

### 5. Check it

1. Sign in to the client portal.
2. Save **Brand Identity**.
3. Open `contact@geeslane.com`. The note should be the green Geeslane card, not a Web3Forms “new form submitted” email.
4. If it fails, open **Edge Functions** → `send-portal-mail` → **Logs**. A Resend domain error means `MAIL_FROM` does not match the verified domain.

Access requests made before sign-in still go through Web3Forms.

## SMS notes (clients and admin)

Clients still receive email. If a phone number is saved on their profile, the same Geeslane comment or milestone update is also sent by SMS.

Admin and team notes (client brief saves, service requests, payments, and other `notifyTeam` messages) still go to `NOTIFY_TEAM_EMAIL`. Set `NOTIFY_TEAM_PHONE` and the same SMS is sent to that number. More than one number is allowed, separated by commas.

Do not put SMS credentials in the website, `.env`, or Git. Use **Termii** (Nigeria) or **Twilio**. If both are set, Termii is used.

### 1. Create an SMS sender

**Termii (recommended for Nigerian numbers)**

1. Sign in at [termii.com](https://termii.com).
2. Copy your API key.
3. Register sender ID `Geeslane` (max 11 characters) if Termii requires it.

**Twilio**

1. Sign in at [twilio.com](https://www.twilio.com).
2. Copy the Account SID and Auth Token.
3. Use a Twilio number or approved sender ID as `TWILIO_FROM`.

### 2. Add secrets in Supabase

In **Project Settings → Edge Functions → Secrets**, add one of these sets, plus the country default:

**Termii**

| Name | Value |
| --- | --- |
| `TERMII_API_KEY` | your Termii API key |
| `TERMII_SENDER_ID` | `Geeslane` |
| `TERMII_CHANNEL` | `generic` |
| `SMS_DEFAULT_COUNTRY` | `234` (used when a number starts with 0) |
| `NOTIFY_TEAM_PHONE` | admin/team mobile, for example `+2348012345678` |

**Twilio**

| Name | Value |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | your Account SID |
| `TWILIO_AUTH_TOKEN` | your Auth Token |
| `TWILIO_FROM` | `+15551234567` or an approved sender ID |
| `SMS_DEFAULT_COUNTRY` | `234` |
| `NOTIFY_TEAM_PHONE` | admin/team mobile, for example `+2348012345678` |

Then redeploy `send-portal-mail` (same function as portal email). Dashboard: paste the updated `index.ts` and deploy. CLI example for Termii:

```
npx supabase secrets set TERMII_API_KEY=YOUR_TERMII_KEY
npx supabase secrets set TERMII_SENDER_ID=Geeslane
npx supabase secrets set TERMII_CHANNEL=generic
npx supabase secrets set SMS_DEFAULT_COUNTRY=234
npx supabase secrets set NOTIFY_TEAM_PHONE=+2348012345678
npx supabase functions deploy send-portal-mail
```

Redeploy `send-portal-mail` after this change even if Termii is already enabled.

### 3. Check it

1. On **Your profile**, save a phone number with country code (for example `+234 801 234 5678`).
2. In admin, post a milestone comment or change a milestone status.
3. The client should get the email and an SMS that starts with `Geeslane`.
4. Have a client save the project brief, or submit a service request. The `NOTIFY_TEAM_PHONE` number should get the team SMS, and `NOTIFY_TEAM_EMAIL` should still get the email.

If SMS is missing, open **Edge Functions → send-portal-mail → Logs**. A Termii sender-ID error means `TERMII_SENDER_ID` is not registered. A Twilio 21608/21610 error means the From number cannot send to that destination. Missing admin SMS with working client SMS usually means `NOTIFY_TEAM_PHONE` is not set.

## Installable portal (PWA)

The client portal can be installed on a phone or computer. It uses `client-portal/manifest.webmanifest` and `client-portal/sw.js`. The service worker caches the portal shell (HTML, CSS, JS, icons). Sign-in codes, live project data, and Paystack still need the network.

After you publish these files to `https://geeslane.com/client-portal/`:

1. Open the portal on HTTPS (or localhost).
2. Chrome or Edge: install from the address bar, or **Menu → Install Geeslane**.
3. iPhone: **Share → Add to Home Screen**.

The home-screen icon is the Geeslane G from `images/logo.png`. Admin is in the same app (`admin.html` shortcut).

## Database extras

After the base schema, run these in **SQL Editor** if they are not already applied:

1. `supabase/milestone_conversations.sql`
2. `supabase/milestone_review_statuses.sql`
3. `supabase/project_brief.sql` — stores the client Discovery answers (goal, audience, first version)
4. `supabase/project_stage_options.sql` — lets admin include or skip Wireframe and Visual design per project, and keeps target date admin-only. After this runs, the Milestones page shows Include checkboxes. Existing projects keep both stages until you uncheck them. If you already ran an earlier version, run this file again.
5. `supabase/service_request.sql` — public Request a Service form, stores the full discovery answers, and copies them into the portal when you approve the client.
6. `supabase/project_agreements.sql` — website project agreement fields (fee, timeline, revisions, deliverables). Admin edits them; clients can view and download the agreement.
7. `supabase/projects_invoices.sql` — lets admin mark one or more projects as active, create invoices and receipts, send them to the client, and lets customers track payment in the portal or on the website with invoice/receipt number + email. If you already ran an earlier version, run this file again to add receipts.
8. `supabase/project_milestone_templates.sql` — new projects get website stages, or three general phases for AI automation, hosting/support, and consultation. Existing projects keep their current milestones. Run this even if you already ran `seed_portal_project.sql`.
9. `supabase/client_add_project.sql` — lets a signed-in client open another project without replacing the ones they already have. More than one project can stay open at the same time. After this runs, Overview lists every project with its brief, payments, milestones, and files.
10. `supabase/project_payments.sql` — project total, paid/remaining on both portals, automatic receipts after Paystack payments. Run this after `projects_invoices.sql`.
11. `supabase/portal_settings.sql` — adds missing brief columns (`goal`, `audience`, `scope`), store bank transfer details for invoices, and lets admin create a client without that error. Run this if you see `column "goal" of relation "project_content" does not exist`. After it runs, set bank details on **Invoices & Receipts**. Redeploy `send-portal-mail` so invoice and receipt emails can attach the PDF.

## Online payments (Paystack)

There is no free card processor. Paystack charges per successful payment and has **no monthly fee**. That is the usual option for NGN on this site.

Do not put the Paystack **secret** key in `config.js`, `.env`, or Git.

1. Create a business at [paystack.com](https://paystack.com) (test mode is enough to try it).
2. Copy the **public key** (`pk_test_…` or `pk_live_…`) into `client-portal/config.js` as `paystackPublicKey`.
3. In **Supabase → Project Settings → Edge Functions → Secrets**, add:
   - `PAYSTACK_SECRET_KEY` — the secret key (`sk_test_…` or `sk_live_…`)
   - `PAYSTACK_PUBLIC_KEY` — same public key as in `config.js`
   - `PORTAL_URL` — `https://geeslane.com/client-portal/`
4. Deploy these functions (dashboard paste, or CLI):
   - `start-payment` from `supabase/functions/start-payment/index.ts` (`verify_jwt` off)
   - `verify-payment` from `supabase/functions/verify-payment/index.ts` (`verify_jwt` off)
   - `paystack-webhook` from `supabase/functions/paystack-webhook/index.ts` (`verify_jwt` off)
5. In Paystack **Settings → API Keys & Webhooks**, set the webhook URL to:
   `https://xostzntvowmdjlwpsevq.supabase.co/functions/v1/paystack-webhook`
6. In Paystack, set **one** default callback URL (test and live each have their own). Use `https://geeslane.com/client-portal/`. You cannot paste a list of callback URLs in the dashboard. Each payment already sends its own `callback_url` (portal or track page, local or live), and that overrides the default.
7. In admin, open **Invoices & Receipts**, set **Project Total**, leave **Show paid and remaining** and **Allow online payment** on, then send an invoice. The client sees **Pay** on unpaid invoices. If Paystack is not configured, that button is **How to pay** and they can use the bank details you saved (those details also print on the invoice PDF).

CLI deploy example:

```
npx supabase functions deploy start-payment
npx supabase functions deploy verify-payment
npx supabase functions deploy paystack-webhook
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_test_your_secret
npx supabase secrets set PAYSTACK_PUBLIC_KEY=pk_test_your_public
npx supabase secrets set PORTAL_URL=https://geeslane.com/client-portal/
```

Manual bank transfers still use **Create a receipt**. Online payments write that receipt themselves.

## Auth behaviour preserved

- Magic links use `supabase.auth.signInWithOtp` with `emailRedirectTo`.
- Callback handling reads the Auth session first, then loads `profiles`.
- Admin access still requires `role = "admin"` and `status = "active"`.
- Database schema, RPCs, and Storage usage are unchanged.

## Rollback archive only

`rollback-archive/` holds the previous Google Apps Script snippets. They are not used by this deployment. Do not paste them into the live Supabase project or the static site.
