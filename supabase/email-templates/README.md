# Account email templates

2026-11-15 recovery repair: the recovery and magic-link templates now use
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
(or `type=magiclink`) instead of ConfirmationURL. The server verifies the
one-time token and sets the website session cookie. Recovery goes to
`/auth/reset-password`; magic links open the collection. Do not substitute
ConfirmationURL: dashboard-generated implicit links return session tokens in a
URL fragment which the server cannot read.

The sign-in page now links to `/auth/password`. After requesting an email, use
the newest link, choose a password, and open the collection. Invalid links show
a useful error. Password updates require a verified signed-in session on the
server. This does not change membership or email-confirmation settings.

Validation: production build and three isolated browser flows passed, covering
reset requests, missing/expired links, password mismatch, authenticated password
updates, subsequent password login, and magic-link session establishment.
These tests use synthetic accounts; real email delivery and the recipient's
final sign-in must still be checked by the recipient. No user passwords were
changed and no emails were sent during this investigation.

Account deletion is not a password-recovery method. The live membership foreign
key references profiles without cascading deletion; an active membership blocks
deleting its profile through Auth. Preserve the account and its attribution.

## Previous setup


2026-11-03: The user connected Resend SMTP. Confirmed custom SMTP enabled, host smtp.resend.com, port 465 and sender name Sydney & Auroville. Applied all six HTML templates and subjects through Supabase Authentication > Emails and reopened saved previews. No test emails were sent; delivery and end-to-end account actions remain unverified.

The other templates preserve their existing Supabase placeholders. Subjects are in subjects.json. Use the existing cream/green palette and system sans-serif fallback, with no tracking or remote images.

Remaining validation: send approved test messages and verify each enabled account action end-to-end. Password recovery still requires a working password-change destination; styling its existing template does not implement that journey. Supabase's administrator invite email is distinct from the site's member invitation and does not itself grant archive membership.

The site's member invitations do not need email delivery. Members copy/share a link or a prepared invitation message; the recipient registers with email/password. Production Confirm email is off as requested. Site URL is https://www.ourmemoryarchive.com with its /auth/callback and /auth/confirm URLs allowed. Legacy Vercel callbacks remain permitted.

Source: https://supabase.com/docs/guides/auth/auth-email-templates
