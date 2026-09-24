# Supabase auth email templates

Paste these HTML files into **Supabase → Authentication → Email Templates**.
Do not put API keys, SMTP passwords, or service-role keys in these files.

## Sender identity (configured in Custom SMTP, not in HTML)

- Sender name: `Geeslane Client Portal`
- Sender email: `no-reply@auth.geeslane.com`
- Primary colour: Geeslane green `#0B6B45`
- Header: `#063B29`
- Accent: restrained red `#C83B3B`

## Files

| Supabase template | File | Subject line |
| --- | --- | --- |
| Magic Link | `magic-link.html` | Your Geeslane 6-Digit Code |
| Confirm signup | `confirm-signup.html` | Confirm Your Geeslane Email |
| Invite user | `invite-user.html` | You’re Invited to Geeslane Client Portal |

Keep the `{{ .ConfirmationURL }}` and `{{ .Token }}` placeholders. Supabase replaces them when the email is sent.

`{{ .Token }}` is the OTP from the project, not from this HTML. If the email shows 8 digits, set **Authentication → Sign In / Providers → Email → Email OTP length** to **6**, save, then send a new code. Direct link: `https://supabase.com/dashboard/project/xostzntvowmdjlwpsevq/auth/providers?provider=Email`
The magic-link template shows a 6-digit code first so people can stay on the portal page and type it into the six boxes. The button is still there as a backup.
If user metadata includes `name`, the greeting becomes `Hi Ada,`. If it does not, it stays `Hi there,`.

Portal activity emails (Brand & Content, requests, milestone updates) are sent from the website using the shared layout in `portal-update.html` / `mail.js`. Billing emails use the same Geeslane logo, green header, and card layout:

| Mail | File | Who receives it | Attachment |
| --- | --- | --- | --- |
| Invoice due | `invoice-due.html` | Client | Invoice PDF |
| Invoice sent | same layout, different copy | Admin | Invoice PDF |
| Payment received | `payment-received.html` | Client | Receipt PDF |
| Payment received | same layout, different copy | Admin | Receipt PDF |

They use the Geeslane logo at `https://geeslane.com/images/logo.png`. Client emails greet by first name when it is known. The PDF is attached so nobody has to open the portal only to download it.

Custom SMTP (Resend) is configured only in the Supabase dashboard. See `DEPLOYMENT.md`. Redeploy `send-portal-mail`, `paystack-webhook`, and `verify-payment` after changing Edge Function mail.
