"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { serverSupabase } from "@/lib/supabase/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { safeNext } from "@/lib/backend/errors";
export async function signIn(_previous: { message: string }, form: FormData) {
  if (!supabaseConfig())
    return {
      message:
        "Save the Supabase URL and publishable key in .env.local, then restart the development server.",
    };
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  if (!email || !password) return { message: "Enter your email and password." };
  try {
    const client = await serverSupabase();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      return {
        message:
          error.code === "email_not_confirmed"
            ? "Your account needs to be activated by Jonas. You do not need to confirm an email; please ask Jonas to finish setting up your access."
            : "We could not sign you in. Check your email and password, or ask the person who invited you for help.",
      };
  } catch {
    return { message: "Sign-in is temporarily unavailable. Please try again." };
  }
  redirect(safeNext(String(form.get("next") || "/")));
}
export async function signUp(_previous: { message: string }, form: FormData) {
  void _previous;
  void form;
  return { message: "Accounts are set up by Jonas. Please contact him for access." };
}
export async function signOut() {
  if (supabaseConfig()) {
    const client = await serverSupabase();
    await client.auth.signOut();
  }
  (await cookies()).delete("active_archive");
  redirect("/sign-in");
}
