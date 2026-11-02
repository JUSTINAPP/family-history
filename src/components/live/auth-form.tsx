"use client";
import { useActionState, useState } from "react";
import { signIn } from "@/app/sign-in/actions";
export function AuthForm({ next, configured }: { next: string; configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, { message: "" });
  const [showPassword, setShowPassword] = useState(false);
  return <div className="auth-panel">
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label className="field"><span>Email</span><input name="email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={254} /></label>
      <label className="field"><span>Password</span><input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" /></label>
      <button type="button" className="subtle-button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide password" : "Show password"}</button>
      {state.message && <p className="notice" role="status">{state.message}</p>}
      <button className="button" disabled={pending || !configured}>{pending ? "Signing in…" : "Sign in"}</button>
    </form>
    <p className="help-line">Use your email and password. Joining for the first time? Open the invitation link sent to you.</p>
  </div>;
}
