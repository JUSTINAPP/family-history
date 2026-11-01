import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, supabaseConfig } from "@/lib/supabase/config";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  function forwardedHeaders() {
    const headers = new Headers(request.headers);
    headers.set("x-archive-path", pathname);
    headers.delete("x-archive-id");
    const archive = request.nextUrl.searchParams.get("archive");
    if (
      archive &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        archive,
      )
    )
      headers.set("x-archive-id", archive);
    // Replace incoming values; only the current Explore URL may scope its gallery.
    headers.delete("x-archive-batch");
    const batch = request.nextUrl.searchParams.get("batch");
    if (
      pathname === "/explore" &&
      batch &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        batch,
      )
    )
      headers.set("x-archive-batch", batch);
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
    const intended = new URLSearchParams(request.nextUrl.search);
    intended.delete("_rsc");
    url.searchParams.set(
      "next",
      pathname + (intended.size ? `?${intended}` : ""),
    );
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }
  // Asset GET controls conditional private caching after auth + file RLS.
  // All of its errors and redirects remain no-store in the route itself.
  if (!pathname.startsWith("/api/v1/assets/"))
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|fonts/|audio/|codecs/|heic-preview-worker.js|favicon.ico).*)",
  ],
};
