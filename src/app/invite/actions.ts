"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { requireArchiveRole } from "@/lib/backend/repository";
export async function createInvitation(_previous: {message: string; link: string}, form: FormData) {
  try {
    const archiveId=String(form.get("archiveId")||"");
    const {client}=await requireArchiveRole(archiveId,"contributor");
    const {data,error}=await client.rpc("create_member_invitation",{p_archive_id:archiveId,p_email:String(form.get("email")||"")});
    if(error || !data)return {message:"Could not create an invitation. The email may already belong to a member, or invitations may not be enabled yet.",link:""};
    return {message:"Invitation ready. Share this link with the person you invited. It expires in seven days.",link:`https://www.ourmemoryarchive.com/auth/join?token=${data}`};
  } catch {return {message:"Could not create an invitation. Please try again.",link:""};}
}
export async function joinInvitation(_previous: {message: string}, form: FormData) {
  const token=String(form.get("token")||""), email=String(form.get("email")||"").trim().toLowerCase(), password=String(form.get("password")||"");
  if(!/^[a-f0-9]{64}$/.test(token) || !email || password.length<8)return {message:"Enter the invited email and a password of at least eight characters."};
  let archiveId: string;
  try {
    const client=await serverSupabase();
    const invitation=await client.rpc("read_member_invitation",{p_token:token});
    if(invitation.error || !invitation.data || invitation.data.email.toLowerCase()!==email)return {message:"This invitation is unavailable, expired or for a different email address."};
    if(form.get("existing")==="yes") {
      const result=await client.auth.signInWithPassword({email,password});
      if(result.error)return {message:"Could not sign in. Check your email and password."};
    } else {
      const result=await client.auth.signUp({email,password,options:{data:{display_name:String(form.get("name")||"").trim()}}});
      if(result.error)return {message:"Could not register. If you already have an account, choose Sign in instead."};
      if(!result.data.session)return {message:"Check your email to confirm your account, then return to this invitation and choose Sign in instead."};
    }
    const accepted=await client.rpc("accept_member_invitation",{p_token:token});
    if(accepted.error || !accepted.data)return {message:"Your account is ready, but the invitation could not be accepted. Retry using Sign in instead, or ask the inviter for help."};
    archiveId=accepted.data;
  } catch {return {message:"Could not join right now. Your invitation can be retried."};}
  (await cookies()).set("active_archive",archiveId,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/"});
  redirect("/");
}
