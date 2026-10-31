// Host is the routed request authority. Do not trust caller-supplied forwarded-host.
// nextUrl may contain Next's internal hostname behind a reverse proxy / next start.
export function isSameOriginRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Authenticated non-browser clients still pass RLS/role checks.
  try {
    const parsed = new URL(origin);
    const host = request.headers.get("host");
    const protocol =
      request.headers.get("x-forwarded-proto") ||
      new URL(request.url).protocol.slice(0, -1);
    return (
      !!host &&
      parsed.origin === `${protocol}://${host}` &&
      ["http:", "https:"].includes(parsed.protocol)
    );
  } catch {
    return false;
  }
}
