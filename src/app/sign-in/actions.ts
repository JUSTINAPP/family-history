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
          "Sign-in was not successful. Check your details and email confirmation, then try again.",
      };
  } catch {
    return { message: "Sign-in is temporarily unavailable. Please try again." };
  }
  redirect(safeNext(String(form.get("next") || "/")));
}
export async function signUp(_previous: { message: string }, form: FormData) {
  if (!supabaseConfig())
    return { message: "Supabase configuration is not saved yet." };
  const email = String(form.get("email") || "").trim();
  const password = String(form.get("password") || "");
  const name = String(form.get("name") || "").trim();
  if (password.length < 12)
    return { message: "Choose a password with at least 12 characters." };
  try {
    const client = await serverSupabase();
    const { error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error)
      return {
        message:
          "Account creation was not completed. Check the project signup settings or try again later.",
      };
    return {
      message:
        "If signup is available for this address, check your email to confirm the account, then sign in.",
    };
  } catch {
    return { message: "Account creation is temporarily unavailable." };
  }
}
export async function signOut() {
  if (supabaseConfig()) {
    const client = await serverSupabase();
    await client.auth.signOut();
  }
  (await cookies()).delete("active_archive");
  redirect("/sign-in");
}
