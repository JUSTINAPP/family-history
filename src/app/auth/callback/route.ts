import { NextResponse, type NextRequest } from "next/server";
import { serverSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/backend/errors";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    try {
      const { error } = await (
        await serverSupabase()
      ).auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(
          new URL(
            safeNext(request.nextUrl.searchParams.get("next")),
            request.url,
          ),
        );
    } catch {
      /* Fail closed. */
    }
  }
  return NextResponse.redirect(
    new URL("/sign-in?error=confirmation", request.url),
  );
}
