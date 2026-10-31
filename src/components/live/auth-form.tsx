"use client";
import { useActionState, useState } from "react";
import { signIn, signUp } from "@/app/sign-in/actions";
export function AuthForm({
  next,
  configured,
}: {
  next: string;
  configured: boolean;
}) {
  const [signup, setSignup] = useState(false);
  const [state, action, pending] = useActionState(signup ? signUp : signIn, {
    message: "",
  });
  return (
    <div className="auth-panel">
      <div className="filter-tabs">
        <button
          className={!signup ? "selected" : ""}
          onClick={() => setSignup(false)}
        >
          Sign in
        </button>
        <button
          className={signup ? "selected" : ""}
          onClick={() => setSignup(true)}
        >
          Create an account
        </button>
      </div>
      <form action={action}>
        <input type="hidden" name="next" value={next} />
        {signup && (
          <label className="field">
            <span>Your name</span>
            <input name="name" autoComplete="name" maxLength={150} required />
          </label>
        )}
        <label className="field">
          <span>Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={signup ? 12 : 1}
            autoComplete={signup ? "new-password" : "current-password"}
          />
        </label>
        {state.message && (
          <p className="notice" role="status">
            {state.message}
          </p>
        )}
        <button className="button" disabled={pending || !configured}>
          {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="help-line">
        No shared password. Each member signs in with their own account.{" "}
        {signup ? "Check your confirmation email before signing in." : ""}
      </p>
    </div>
  );
}
