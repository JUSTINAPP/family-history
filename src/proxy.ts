import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, supabaseConfig } from "@/lib/supabase/config";
import { HOME_VISIT_COOKIE } from "@/lib/home-visit";
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // A session preference keeps server-rendered Home stable through reload/back.
  // No item IDs, metadata or authentication information are stored here.
  const previousVisit = request.cookies.get(HOME_VISIT_COOKIE)?.value;
  // Initialise on the entry page too: a sign-in Server Action can render Home
  // directly, without a separate Home request through Proxy.
  const newVisit = !pathname.startsWith("/api/") && !/^[a-f0-9-]{36}$/.test(previousVisit || "")
    ? crypto.randomUUID() : null;
  if (newVisit) request.cookies.set(HOME_VISIT_COOKIE, newVisit);
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
  function nextResponse() {
    const next = NextResponse.next({ request: { headers: forwardedHeaders() } });
    if (newVisit) next.cookies.set(HOME_VISIT_COOKIE, newVisit, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    });
    return next;
  }
  let response = nextResponse();
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
        response = nextResponse();
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
  // Derivative GETs control private revalidation after auth + file RLS.
  // All of its errors and redirects remain no-store in the route itself.
  if (!(request.method==="GET" && (pathname.startsWith("/api/v1/assets/") || pathname.startsWith("/api/v1/previews/"))))
    response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|images/|fonts/|audio/[^/]+\\.(?:wav|mp3|m4a|ogg|webm)$|codecs/|heic-preview-worker.js|favicon.ico).*)",
  ],
};
