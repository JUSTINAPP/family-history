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
      if (!error)
        return NextResponse.redirect(
          new URL(
            safeNext(request.nextUrl.searchParams.get("next")),
            request.url,
          ),
        );
    } catch {
      /* Do not log tokens or raw provider errors. */
    }
  }
  return NextResponse.redirect(
    new URL("/sign-in?error=confirmation", request.url),
  );
}
