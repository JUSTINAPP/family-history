import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, supabaseConfig } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  function forwardedHeaders() {
    const headers = new Headers(request.headers);
    headers.set("x-archive-path", pathname);
    return headers;
  }
  let response = NextResponse.next({
    request: { headers: forwardedHeaders() },
  });
  if (isDemoMode()) return response;
  const open = pathname === "/sign-in" || pathname.startsWith("/auth/");
  const api = pathname.startsWith("/api/");
  const config = supabaseConfig();
  if (!config) {
    if (open || api) return response;
    return NextResponse.redirect(
      new URL("/sign-in?setup=configuration", request.url),
    );
  }
  const client = createServerClient(config.url, config.key, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: { headers: forwardedHeaders() },
        });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  let valid = false;
  try {
    const { data, error } = await client.auth.getClaims();
    valid = !error && !!data?.claims;
  } catch {
    /* Fail closed without exposing token/network details. */
  }
  if (!valid && !open && !api) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|fonts/|audio/|codecs/|heic-preview-worker.js|favicon.ico).*)",
  ],
};
