import "server-only";
import { cache } from "react";
import { measuredFetch } from "@/lib/backend/performance";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { supabaseConfig } from "./config";
export const serverSupabase = cache(async function serverSupabase() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase configuration is required.");
  const store = await cookies();
  const incoming = await headers();
  const bearer = incoming.get("authorization");
  return createServerClient(config.url, config.key, {
    global: {
      fetch: measuredFetch,
      ...(bearer?.startsWith("Bearer ")
        ? { headers: { Authorization: bearer } }
        : {}),
    },
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server components cannot write; proxy refreshes cookies. */
        }
      },
    },
  });
});
export const authenticatedClient = cache(async function authenticatedClient() {
  const client = await serverSupabase();
  const bearer = (await headers()).get("authorization");
  const { data, error } = await client.auth.getUser(
    bearer?.startsWith("Bearer ") ? bearer.slice(7) : undefined,
  );
  if (error || !data.user) return null;
  return { client, user: data.user };
});
