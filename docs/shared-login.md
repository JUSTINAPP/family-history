# Shared archive sign-in

The application now presents one sign-in form for accounts Jonas provisions, with email/password and a password visibility toggle. Self-signup returns an explanatory message; archive creation is disabled in the application action and `/archives/new` redirects home. Live navigation displays the archive identity without an archive chooser.

Authentication and database membership checks remain intact. An authenticated account without access receives an explicit access-not-ready screen rather than archive creation. An unconfirmed account receives an activation message addressed to the administrator, not instructions to wait for email.

## Outstanding production setup

Adding an Authentication user does not grant archive membership. Each intended recipient must have an activated password account and an active membership in the existing live archive, with the intended role. Do not grant membership to every existing Auth user indiscriminately. Preserve suspended memberships and existing roles. Do not create a replacement archive.

The available Supabase browser session redirected away from project `amttkuubpicjgizjvqqf`, so production user activation and membership could not be inspected or repaired. The public Auth endpoint responded successfully; anonymous database access was denied as expected. No production account or database changes were made.

This change does not disable Supabase public signups at the provider level or alter database RPC privileges. Those settings require inspection of the correct project. Existing membership-scoped archive loading is preserved; a canonical archive ID has not been guessed or hard-coded.

## Validation

Lint, TypeScript, production build, whitespace checks and four authentication/browser tests passed, including mobile accessibility, password visibility, absence of signup controls, private route/API protection and safe redirects. Real invited-user sign-in remains unverified until production account access is available.
