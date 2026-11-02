import {serverSupabase} from "@/lib/supabase/server";
import {JoinForm} from "@/components/live/join-form";
export const metadata={title:"Join the archive",referrer:"no-referrer" as const};
export default async function JoinPage({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const {token=""}=await searchParams;
  const client=await serverSupabase();
  const {data,error}=/^[a-f0-9]{64}$/.test(token)?await client.rpc("read_member_invitation",{p_token:token}):{data:null,error:true};
  return <section className="capture-shell">{!error&&data?<><h1>Join {data.archiveName}</h1><p>Create your account to see the collection and share your memories.</p><JoinForm token={token} email={data.email}/></>:<><h1>Invitation unavailable</h1><p>This invitation may have expired or already been used. Ask the person who invited you for a new link, or sign in if you already joined.</p><a className="button" href="/sign-in">Sign in</a></>}</section>;
}
