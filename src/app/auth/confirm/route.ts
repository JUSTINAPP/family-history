import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/backend/errors";
export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (
    token_hash &&
    [
      "email",
      "signup",
      "recovery",
      "invite",
      "magiclink",
      "email_change",
    ].includes(type || "")
  ) {
    try {
      const { error } = await (
        await serverSupabase()
      ).auth.verifyOtp({ token_hash, type: type as EmailOtpType });
      if (!error) {
        const destination = type === "recovery"
          ? "/auth/reset-password"
          : safeNext(request.nextUrl.searchParams.get("next"));
        // Stay on the browser's origin, including behind a reverse proxy.
        return new NextResponse(null, { status: 303, headers: { Location: destination } });
      }
    } catch {
      /* Do not log tokens or raw provider errors. */
    }
  }
  return new NextResponse(null, { status: 303, headers: { Location: "/sign-in?error=confirmation" } });
}
