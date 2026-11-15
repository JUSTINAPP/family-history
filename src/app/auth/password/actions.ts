"use server";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";

export async function requestPasswordReset(_previous: { message: string }, form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { message: "Enter your email address." };
  try {
    const { error } = await (await serverSupabase()).auth.resetPasswordForEmail(email);
    if (error && (error.status === 429 || (error.status || 0) >= 500))
      return { message: "We cannot send a link right now. Please wait a few minutes and try again." };
  } catch {
    return { message: "We cannot send a link right now. Please try again shortly." };
  }
  return { message: "If this email has an account, a reset link is on its way. Check your inbox and spam folder, and use the newest link." };
}

export async function updatePassword(_previous: { message: string }, form: FormData) {
  const password = String(form.get("password") || "");
  if (password.length < 8 || password.length > 128)
    return { message: "Choose a password between 8 and 128 characters." };
  if (password !== String(form.get("confirmPassword") || ""))
    return { message: "The passwords do not match. Please try again." };
  try {
    const client = await serverSupabase();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user)
      return { message: "Your reset session has expired. Request a new link below." };
    const result = await client.auth.updateUser({ password });
    if (result.error)
      return { message: result.error.code === "same_password"
        ? "Choose a different password from your previous one."
        : "We could not save that password. Try a different password or request a new link." };
  } catch {
    return { message: "We could not save your password. Please try again shortly." };
  }
  redirect("/auth/password/saved");
}
