"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { requestPasswordReset, updatePassword } from "@/app/auth/password/actions";
export function PasswordForm({ reset = false }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(reset ? updatePassword : requestPasswordReset, { message: "" });
  const [show, setShow] = useState(false);
  return <div className="auth-panel"><form action={action}>
    {reset ? <>
      <label className="field"><span>New password</span><input name="password" type={show ? "text" : "password"} minLength={8} maxLength={128} required autoComplete="new-password" /></label>
      <label className="field"><span>Confirm new password</span><input name="confirmPassword" type={show ? "text" : "password"} minLength={8} maxLength={128} required autoComplete="new-password" /></label>
      <button type="button" className="subtle-button" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Hide passwords" : "Show passwords"}</button>
    </> : <label className="field"><span>Email</span><input name="email" type="email" required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false} /></label>}
    {state.message && <p className="notice" role="status">{state.message}</p>}
    <button className="button" disabled={pending}>{pending ? (reset ? "Saving…" : "Sending…") : (reset ? "Save new password" : "Send reset link")}</button>
  </form>
  <p className="help-line">{reset ? <Link href="/auth/password">Request a new reset link</Link> : <Link href="/sign-in">Back to sign in</Link>}</p>
  </div>;
}
