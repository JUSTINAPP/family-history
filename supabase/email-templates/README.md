# Account email templates — applied to production

2026-11-03: The user connected Resend SMTP. Confirmed custom SMTP enabled, host smtp.resend.com, port 465 and sender name Sydney & Auroville. Applied all six HTML templates and subjects through Supabase Authentication > Emails and reopened saved previews. No test emails were sent; delivery and end-to-end account actions remain unverified.

These six HTML templates preserve Supabase ConfirmationURL/Token placeholders. Subjects are in subjects.json. Use the existing cream/green palette and system sans-serif fallback, with no tracking or remote images.

Remaining validation: send approved test messages and verify each enabled account action end-to-end. Password recovery still requires a working password-change destination; styling its existing template does not implement that journey. Supabase's administrator invite email is distinct from the site's member invitation and does not itself grant archive membership.

The site's member invitations do not need email delivery. Members copy/share a link or a prepared invitation message; the recipient registers with email/password. Production Confirm email is off as requested. Site URL is https://www.ourmemoryarchive.com with its /auth/callback and /auth/confirm URLs allowed. Legacy Vercel callbacks remain permitted.

Source: https://supabase.com/docs/guides/auth/auth-email-templates
