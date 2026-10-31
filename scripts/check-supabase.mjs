import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
nextEnv.loadEnvConfig(process.cwd(), false, {
  info: () => {},
  error: () => {},
});
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log(
    "Supabase configuration: missing URL or publishable/anon key. Save .env.local.",
  );
  process.exitCode = 1;
} else if (key.startsWith("sb_secret_")) {
  console.log(
    "Configuration rejected: use a publishable/anon key, never a secret key.",
  );
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(new URL("/auth/v1/settings", url), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000),
    });
    console.log(
      `Supabase Auth endpoint: ${response.ok ? "reachable" : "not ready"} (HTTP ${response.status}).`,
    );
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.from("archives").select("id").limit(0);
    console.log(
      `Archive schema: ${!error ? "available (anonymous query returned no record data)" : error.code === "PGRST205" || error.code === "42P01" ? "migrations not applied" : error.code === "42501" ? "present; anonymous access denied as expected" : "not yet verified; apply migrations and test with an authenticated account"}.`,
    );
  } catch {
    console.log(
      "Supabase could not be reached. Check saved configuration and network access.",
    );
    process.exitCode = 1;
  }
}
