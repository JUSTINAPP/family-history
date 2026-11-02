# Account email templates — prepared, not activated

2026-11-03: The production Supabase Free project uses the default email service. Its dashboard blocks custom subjects/bodies until custom SMTP is connected (or the project is upgraded). No emails were sent and no paid plan was purchased.

These six HTML templates preserve Supabase ConfirmationURL/Token placeholders. Subjects are in subjects.json. Use the existing cream/green palette and system sans-serif fallback, with no tracking or remote images.

Before activation: configure a verified sender for ourmemoryarchive.com, paste each template and subject in Authentication > Emails, render test messages, and verify each enabled account action end-to-end. Password recovery must have a working password-change destination before enabling its template. Templates alone do not implement that journey. Supabase's administrator invite email is distinct from the site's member invitation and does not itself grant archive membership.

The site's member invitations do not need email delivery. Members copy/share a link or a prepared invitation message; the recipient registers with email/password. Production Confirm email is off as requested. Site URL is https://www.ourmemoryarchive.com with its /auth/callback and /auth/confirm URLs allowed. Legacy Vercel callbacks remain permitted.

Source: https://supabase.com/docs/guides/auth/auth-email-templates
