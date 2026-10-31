// Synthetic loopback-only Supabase protocol fixture. Never contacts or seeds a Supabase project.
import { createServer } from "node:http";
import { createHmac, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
export const ARCHIVE = "60000000-0000-4000-8000-000000000001";
export const OTHER_ARCHIVE = "60000000-0000-4000-8000-000000000002";
export const USER = "60000000-0000-4000-8000-000000000003";
export const ITEM = "60000000-0000-4000-8000-000000000004";
export const BATCH = "60000000-0000-4000-8000-000000000005";
export const COUNT = 1007;
export async function fixtureServer(port = 4301, { previewFile } = {}) {
  const original = await readFile(previewFile || "public/images/beach.jpg"),
    hash = createHash("sha256").update(original).digest("hex");
  const now = Math.floor(Date.now() / 1000),
    url = `http://127.0.0.1:${port}`,
    user = {
      id: USER,
      email: "visibility@example.test",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "email" },
      user_metadata: { display_name: "Test contributor" },
      created_at: new Date().toISOString(),
    };
  const enc = (value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned =
    enc({ alg: "HS256", typ: "JWT" }) +
    "." +
    enc({
      sub: USER,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      iss: url + "/auth/v1",
      iat: now,
      exp: now + 3600,
    });
  const token =
    unsigned +
    "." +
    createHmac("sha256", "local-test-only-key")
      .update(unsigned)
      .digest("base64url");
  const archive = (id, name, created) => ({
    id,
    name,
    slug: id,
    description: "",
    privacy: "members_only",
    settings: {},
    created_at: created,
    created_by: USER,
    owner_membership_id: USER,
  });
  const archives = [
    archive(OTHER_ARCHIVE, "Other test archive", "2020-01-01T00:00:00Z"),
    archive(ARCHIVE, "Test archive", "2021-01-01T00:00:00Z"),
  ];
  const rows = Array.from({ length: previewFile ? 1 : COUNT }, (_, index) => ({
    id:
      index === 0
        ? ITEM
        : `61000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    archive_id: ARCHIVE,
    client_capture_id: `62000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title: index === 0 ? "" : `Uncatalogued photograph ${index}`,
    kind: "Photograph",
    notes: "",
    reported_date: "",
    date_precision: "unknown",
    reported_place: "",
    people_text: "",
    evidence_status: "family_reported",
    ingestion_status: index === 1 ? "failed" : "ready",
    contributed_by: USER,
    catalogued_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }));
  const files = rows.flatMap((row, index) =>
    Array.from({ length: index === 0 ? 2 : 1 }, (_, page) => ({
      id: `63000000-0000-4000-${page === 0 ? "8000" : "9000"}-${String(index).padStart(12, "0")}`,
      archive_id: ARCHIVE,
      item_id: row.id,
      purpose: "original",
      status: "stored",
      bucket_id: "archive-originals",
      storage_path: `${ARCHIVE}/${row.id}/${page}`,
      mime_type: previewFile ? "image/heic" : "image/jpeg",
      original_filename: `original-${index}-${page}.${previewFile ? "heic" : "jpg"}`,
      byte_size: original.length,
      sha256: hash,
      page_order: page,
      page_role: page ? "back" : "front",
      uploaded_by: USER,
      created_at: row.created_at,
    })),
  );
  const requests = [];
  const objects = new Map(
    files.map((f) => [`${f.bucket_id}/${f.storage_path}`, original]),
  );
  let failPreview = false;
  const attempts = new Map();
  let failList = false;
  const server = createServer(async (req, res) => {
    const address = new URL(req.url, url);
    requests.push({
      path: address.pathname,
      query: address.search,
      method: req.method,
    });
    function send(status, value, headers = {}) {
      res.writeHead(status, { "Content-Type": "application/json", ...headers });
      res.end(value === null ? "" : JSON.stringify(value));
    }
    if (address.pathname === "/__fixture/failure") {
      failList = address.searchParams.get("list") === "1";
      failPreview = address.searchParams.get("preview") === "1";
      return send(200, { ok: true });
    }
    if (address.pathname === "/__fixture/summary")
      return send(200, {
        count: rows.length,
        originalHash: hash,
        attempts: [...attempts.values()],
        displays: files.filter((f) => f.purpose === "display"),
        originalHashes: files
          .filter((f) => f.purpose === "original")
          .map((f) =>
            createHash("sha256")
              .update(objects.get(`${f.bucket_id}/${f.storage_path}`))
              .digest("hex"),
          ),
        requests: requests
          .filter((r) => r.path.startsWith("/rest/v1/archive_items"))
          .slice(-30),
      });
    if (address.pathname === "/auth/v1/token")
      return send(200, {
        access_token: token,
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    if (address.pathname === "/auth/v1/logout") return send(204, null);
    if (address.pathname === "/auth/v1/user")
      return req.headers.authorization === `Bearer ${token}`
        ? send(200, user)
        : send(401, { message: "Not signed in" });
    if (req.headers.authorization !== `Bearer ${token}`)
      return send(401, { message: "Not signed in" });
    if (address.pathname.startsWith("/storage/v1/object/")) {
      if (previewFile) {
        const key = decodeURIComponent(
          address.pathname.replace(
            /^\/storage\/v1\/object\/(?:authenticated\/)?/,
            "",
          ),
        );
        if (req.method === "POST") {
          if (!key.startsWith("archive-derived/"))
            return send(403, { message: "Immutable original" });
          if (objects.has(key)) return send(409, { message: "Duplicate" });
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          objects.set(key, Buffer.concat(chunks));
          return send(200, { Key: key });
        }
        const value = objects.get(key);
        if (!value) return send(404, { message: "Object missing" });
        if (failPreview && key.startsWith("archive-originals/"))
          return send(503, { message: "Synthetic source read outage" });
        res.writeHead(200, {
          "Content-Type": key.startsWith("archive-derived/")
            ? "image/jpeg"
            : "image/heic",
        });
        res.end(value);
        return;
      }
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": original.length,
      });
      res.end(original);
      return;
    }
    if (address.pathname === "/rest/v1/rpc/can_access_archive")
      return send(200, true);
    if (previewFile && address.pathname.startsWith("/rest/v1/rpc/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      const rpc = address.pathname.split("/").pop();
      if (rpc === "reserve_display") {
        const s = files.find((f) => f.id === body.p_source_id);
        let d = files.find((f) => f.parent_original_id === s.id);
        if (!d) {
          d = {
            ...s,
            id: crypto.randomUUID(),
            purpose: "display",
            parent_original_id: s.id,
            status: "reserved",
            bucket_id: "archive-derived",
            mime_type: "image/jpeg",
            sha256: body.p_sha256,
            byte_size: body.p_size,
            width: body.p_width,
            height: body.p_height,
          };
          d.storage_path = `${ARCHIVE}/${ITEM}/${d.id}`;
          files.push(d);
        }
        return send(200, d.id);
      }
      if (rpc === "complete_display") {
        const f = files.find((f) => f.id === body.p_file_id);
        f.status = "stored";
        return send(200, null);
      }
      if (rpc === "begin_preview_attempt") {
        const a = {
          original_file_id: body.p_source_id,
          attempt_id: crypto.randomUUID(),
          stage: "download",
          status: "processing",
        };
        attempts.set(body.p_source_id, a);
        return send(200, a.attempt_id);
      }
      if (rpc === "record_preview_attempt") {
        const a = attempts.get(body.p_source_id);
        Object.assign(a, {
          stage: body.p_stage,
          error_code: body.p_error_code,
          status: body.p_error_code
            ? "failed"
            : body.p_stage === "complete"
              ? "complete"
              : "processing",
        });
        return send(200, null);
      }
    }
    if (address.pathname.startsWith("/rest/v1/rpc/"))
      return send(503, { code: "fixture_preview_unavailable" });
    const table = address.pathname.split("/").pop();
    if (
      table === "archive_items" &&
      failList &&
      !address.searchParams.has("id")
    )
      return send(503, { code: "fixture_list_unavailable" });
    // These optional resources fail to prove item discovery/detail does not depend on them.
    if (
      [
        "processing_jobs",
        "activity_log",
        "import_batch_items",
        "recollection_audio",
      ].includes(table)
    )
      return send(503, { code: "fixture_optional_unavailable" });
    let data =
      table === "import_batches"
        ? [
            {
              id: BATCH,
              archive_id: ARCHIVE,
              context: "Fixture batch",
              expected_count: 1,
              created_by: USER,
              created_at: "2026-01-01T00:00:00Z",
            },
          ]
        : table === "archives"
          ? archives
          : table === "archive_items"
            ? rows
            : table === "archive_item_files"
              ? files
              : table === "archive_memberships"
                ? archives.map((a) => ({
                    id: USER,
                    archive_id: a.id,
                    profile_id: USER,
                    role: "contributor",
                    status: "active",
                    joined_at: a.created_at,
                    profiles: {
                      display_name: "Test contributor",
                      email: user.email,
                    },
                  }))
                : [];
    for (const [key, value] of address.searchParams) {
      if (value.startsWith("eq.") && !key.includes("."))
        data = data.filter((row) => String(row[key]) === value.slice(3));
    }
    if (
      address.searchParams.get("select")?.includes("import_batch_items!inner")
    )
      data = data.filter((row) => row.id === ITEM); // One existing grouped item in the synthetic batch.
    const count = data.length,
      order = address.searchParams.get("order");
    if (order)
      data = [...data].sort((a, b) => {
        for (const term of order.split(",")) {
          const [field, direction] = term.split(".");
          const comparison = String(a[field] ?? "").localeCompare(
            String(b[field] ?? ""),
          );
          if (comparison) return comparison * (direction === "desc" ? -1 : 1);
        }
        return 0;
      });
    const offset = Number(address.searchParams.get("offset") || 0),
      limit = Math.min(127, Number(address.searchParams.get("limit") || 1000));
    data = data.slice(offset, offset + limit);
    const headers = {
      "Content-Range": `${offset}-${offset + Math.max(0, data.length - 1)}/${count}`,
    };
    if (req.headers.accept?.includes("vnd.pgrst.object+json"))
      return data.length === 1
        ? send(200, data[0], headers)
        : send(406, { code: "PGRST116" }, headers);
    send(200, data, headers);
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { server, hash };
}
