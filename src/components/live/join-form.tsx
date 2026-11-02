"use client";
import {useActionState,useState} from "react";
import {joinInvitation} from "@/app/invite/actions";
export function JoinForm({token,email}:{token:string;email:string}) {
  const [state,action,pending]=useActionState(joinInvitation,{message:""});
  const [existing,setExisting]=useState(false);
  return <div className="auth-panel"><form action={action}>
    <input type="hidden" name="token" value={token}/><input type="hidden" name="existing" value={existing?"yes":"no"}/>
    {!existing&&<label className="field">Your name<input name="name" autoComplete="name" required maxLength={120}/></label>}
    <label className="field">Email<input name="email" type="email" value={email} readOnly autoComplete="username"/></label>
    <label className="field">{existing?"Password":"Choose a password"}<input name="password" type="password" required minLength={8} autoComplete={existing?"current-password":"new-password"}/></label>
    {state.message&&<p role="status">{state.message}</p>}
    <button className="button" disabled={pending}>{pending?"Joining…":existing?"Sign in and join":"Create account and join"}</button>
    <button type="button" className="subtle-button" disabled={pending} onClick={()=>setExisting(!existing)}>{existing?"Create a new account instead":"Already have an account? Sign in instead"}</button>
  </form></div>;
}
