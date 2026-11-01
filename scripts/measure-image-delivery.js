// Paste into the browser console on the signed-in existing item page, before/after deployment.
// Read-only. Only preview/derived endpoints are fetched; no originals, cookies or signed URLs are logged.
(async () => {
  const urls = [
    ...new Set(
      [...document.querySelectorAll("main img")]
        .map((img) => img.currentSrc || img.src)
        .filter((src) => /\/api\/v1\/(previews|assets)\//.test(src)),
    ),
  ];
  const report = [];
  for (const url of urls) {
    const started = performance.now();
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    });
    const blob = await response.blob();
    let dimensions = null;
    try {
      const image = await createImageBitmap(blob);
      dimensions = { width: image.width, height: image.height };
      image.close();
    } catch {
      /* Keep useful HTTP diagnostics if delivery failed. */
    }
    report.push({
      path: new URL(url, location.href).pathname,
      status: response.status,
      type: blob.type,
      bytes: blob.size,
      ...dimensions,
      totalMs: Math.round(performance.now() - started),
      serverTiming: response.headers.get("server-timing"),
      asset:
        response.headers.get("x-archive-asset") ||
        "check JPEG receipt; the HEIC preview endpoint does not serve an HEIC master",
    });
  }
  console.table(report);
  return report;
})();
