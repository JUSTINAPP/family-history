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
export async function fixtureServer(
  port = 4301,
  { previewFile, management = false } = {},
) {
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
  const imageSets = [];
  let quickSeedCount=0;
  const currentSets = () => [
    ...new Map(
      [...imageSets]
        .filter((s) => s.status === "stored")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((s) => [s.original_file_id, s]),
    ).values(),
  ];
  const deletions = [];
  const places = [],
    itemPlaces = [];
  const people = management
    ? [
        "Jina Allen",
        "Jan Allen",
        "Jonas Allen",
        "Johnny Allen",
        "Craig Cork",
      ].map((name, index) => ({
        id: `64000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        archive_id: ARCHIVE,
        display_name: name,
        slug: `64000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        category: "family",
        biography: "",
        lifespan: "",
      }))
    : [];
  const identifications = [],
    recollections = [],
    comments = [],
    documentRuns = [],
    documentTexts = [],
    documentSuggestions = [],
    documentVersions = new Map(),
    provenance = [];
  const requests = [];
  const objects = new Map(
    files.map((f) => [`${f.bucket_id}/${f.storage_path}`, original]),
  );
  let failPreview = false;
  let failDelete = false;
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
    if (address.pathname === "/__fixture/metrics") {
      const counts = {};
      for (const entry of requests.filter(
        (r) => !r.path.startsWith("/__fixture/"),
      ))
        counts[entry.path] = (counts[entry.path] || 0) + 1;
      if (address.searchParams.has("reset")) requests.length = 0;
      return send(200, counts);
    }
    if (address.pathname === "/__fixture/places-material" && management) {
      const material = rows.filter((r) => r.title?.startsWith("Linked "));
      for (let n = 0; n < 33; n++) {
        const id = crypto.randomUUID(),
          name =
            n === 0
              ? "01 Auroville"
              : n === 1
                ? "02 Sydney"
                : n === 2
                  ? "03 An empty place"
                  : `Place ${String(n).padStart(2, "0")}`;
        places.push({
          id,
          archive_id: ARCHIVE,
          name,
          locality: "",
          city: "",
          region: n === 0 ? "Tamil Nadu" : "",
          country: n === 0 ? "India" : "",
          notes: "",
          latitude: null,
          longitude: null,
          created_by: USER,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        });
        if (n !== 2)
          for (const item of n === 1 ? material.slice(0, 1) : material)
            itemPlaces.push({
              id: crypto.randomUUID(),
              archive_id: ARCHIVE,
              item_id: item.id,
              place_id: id,
              role: n === 0 ? "primary" : "related",
              status: "reported",
              source: "human_report",
              reported_text: item.reported_place || "",
              created_by: USER,
              created_at: "2026-01-01T00:00:00Z",
            });
      }
      // Unique below-fold asset URLs avoid conflating lazy loading with reuse
      // of images already decoded for other, visible Places.
      const template = imageSets.find((s) => s.status === "stored"),
        source = files.find((f) => f.id === template.original_file_id);
      const id = crypto.randomUUID(),
        originalId = crypto.randomUUID();
      rows.push({ ...material[0], id, title: "Below-fold Place material" });
      const originalCopy = {
        ...source,
        id: originalId,
        item_id: id,
        storage_path: `${ARCHIVE}/${id}/${originalId}`,
      };
      files.push(originalCopy);
      objects.set(`${source.bucket_id}/${originalCopy.storage_path}`, original);
      const set = {
        ...template,
        id: crypto.randomUUID(),
        item_id: id,
        original_file_id: originalId,
      };
      for (const key of [
        "display_file_id",
        "thumbnail_file_id",
        "small_file_id",
      ]) {
        const old = files.find((f) => f.id === template[key]),
          file = {
            ...old,
            id: crypto.randomUUID(),
            item_id: id,
            parent_original_id: originalId,
          };
        file.storage_path = `${ARCHIVE}/${id}/${file.id}`;
        files.push(file);
        objects.set(
          `${file.bucket_id}/${file.storage_path}`,
          objects.get(`${old.bucket_id}/${old.storage_path}`),
        );
        set[key] = file.id;
      }
      imageSets.push(set);
      for (let n = itemPlaces.length - 1; n >= 0; n--)
        if (itemPlaces[n].place_id === places.at(-1).id)
          itemPlaces.splice(n, 1);
      itemPlaces.push({
        id: crypto.randomUUID(),
        archive_id: ARCHIVE,
        item_id: id,
        place_id: places.at(-1).id,
        role: "primary",
        status: "reported",
        source: "human_report",
        reported_text: "",
        created_by: USER,
        created_at: "2026-01-01T00:00:00Z",
      });
      return send(200, { places, materialIds: material.map((i) => i.id) });
    }
    if (address.pathname === "/__fixture/people-material" && management) {
      const template = imageSets.find((s) => s.status === "stored");
      const source = files.find((f) => f.id === template.original_file_id);
      people.length = 0;
      for (let n = 0; n < 33; n++) {
        const id = crypto.randomUUID();
        people.push({
          id,
          slug: id,
          archive_id: ARCHIVE,
          display_name:
            n === 0
              ? "01 Many materials"
              : n === 1
                ? "02 One material"
                : n === 2
                  ? "03 No material"
                  : `Person ${String(n).padStart(2, "0")}`,
          category: "family",
          biography: "",
          lifespan: "",
        });
      }
      const materialIds = [];
      for (const [index, kind] of [
        "Photograph",
        "Photograph",
        "Letter",
        "Document",
        "Object",
      ].entries()) {
        const id = crypto.randomUUID(),
          originalId = crypto.randomUUID();
        rows.push({
          ...rows.find((r) => !r.archived_at),
          id,
          title: `Linked ${kind} ${index}`,
          kind,
          archived_at: null,
          split_from: null,
          reported_date: "1965",
          catalogued_at: null,
        });
        const originalCopy = {
          ...source,
          id: originalId,
          item_id: id,
          storage_path: `${ARCHIVE}/${id}/${originalId}`,
        };
        files.push(originalCopy);
        objects.set(
          `${source.bucket_id}/${originalCopy.storage_path}`,
          original,
        );
        const set = {
          ...template,
          id: crypto.randomUUID(),
          item_id: id,
          original_file_id: originalId,
        };
        for (const key of [
          "display_file_id",
          "thumbnail_file_id",
          "small_file_id",
        ]) {
          const old = files.find((f) => f.id === template[key]);
          const file = {
            ...old,
            id: crypto.randomUUID(),
            item_id: id,
            parent_original_id: originalId,
          };
          file.storage_path = `${ARCHIVE}/${id}/${file.id}`;
          files.push(file);
          objects.set(
            `${file.bucket_id}/${file.storage_path}`,
            objects.get(`${old.bucket_id}/${old.storage_path}`),
          );
          set[key] = file.id;
        }
        imageSets.push(set);
        materialIds.push(id);
        for (const person of people.filter(
          (p, n) => n === 0 || (n === 1 && index === 0) || n > 2,
        ))
          identifications.push({
            id: crypto.randomUUID(),
            archive_id: ARCHIVE,
            item_id: id,
            person_id: person.id,
            proposed_name: person.display_name,
            proposed_by: USER,
            status: index === 0 ? "accepted" : "reported",
            created_at: "2026-01-01T00:00:00Z",
          });
      }
      recollections.push({
        id: crypto.randomUUID(),
        archive_id: ARCHIVE,
        item_id: materialIds[0],
        original_text: "Words preserved with this linked photograph",
        recorded_at: "2026-01-01T00:00:00Z",
      });
      return send(200, { people, materialIds });
    }
    if (address.pathname === "/__fixture/document-item" && management) {
      const template=imageSets.find(s=>s.status==="stored"),source=files.find(f=>f.id===template.original_file_id);
      const id=crypto.randomUUID(),sourceIds=[];
      rows.push({...rows.find(r=>!r.archived_at),id,kind:"Letter",title:"Fixture four-page letter",grouping_kind:"single_object",archived_at:null,split_from:null,lifecycle:"active",ingestion_status:"ready",reported_date:"",date_precision:"unknown",reported_place:"",people_text:"",notes:"",catalogued_at:null});
      const roles=["envelope-front","envelope-back","page-front","page-back"];
      for(let n=0;n<4;n++) {
        const originalId=crypto.randomUUID();sourceIds.push(originalId);
        const f={...source,id:originalId,item_id:id,page_order:n,page_role:roles[n],original_filename:`document-${n+1}.heic`,storage_path:`${ARCHIVE}/${id}/${originalId}`};
        files.push(f);objects.set(`${f.bucket_id}/${f.storage_path}`,original);
        const set={...template,id:crypto.randomUUID(),item_id:id,original_file_id:originalId};
        for(const key of ["display_file_id","thumbnail_file_id","small_file_id"]) {
          const old=files.find(f=>f.id===template[key]),derived={...old,id:crypto.randomUUID(),item_id:id,parent_original_id:originalId,page_order:n};
          derived.storage_path=`${ARCHIVE}/${id}/${derived.id}`;files.push(derived);objects.set(`${derived.bucket_id}/${derived.storage_path}`,objects.get(`${old.bucket_id}/${old.storage_path}`));set[key]=derived.id;
        }imageSets.push(set);
      }
      let person=people.find(p=>p.display_name==="Jan Allen");
      if(!person){const pid=crypto.randomUUID();person={id:pid,slug:pid,archive_id:ARCHIVE,display_name:"Jan Allen",category:"family",biography:"",lifespan:""};people.push(person);}
      let place=places.find(p=>p.name==="Auroville");
      if(!place){place={id:crypto.randomUUID(),archive_id:ARCHIVE,name:"Auroville",locality:"",city:"",region:"Tamil Nadu",country:"India",notes:"",latitude:null,longitude:null};places.push(place);}
      const manifest=sourceIds.map((fid,n)=>({id:fid,page_order:n,page_role:roles[n],sha256:hash}));
      const runId=crypto.randomUUID(),translationId=crypto.randomUUID();
      const text=["Cher Jan, Auroville, 17 August 1978. [unclear]","Une lettre de notre famille.","We will travel together.","Au revoir."];
      for(const [operation,rid] of [["transcribe",runId],["translate",translationId]]) {
        documentRuns.push({id:rid,archive_id:ARCHIVE,item_id:id,source_manifest:manifest,source_version:"fixture-document-v1",source_texts:operation==="translate"?sourceIds.map((fid,n)=>({original_file_id:fid,text:text[n],review_revision:0,transcription_id:documentTexts.find(t=>t.document_run_id===runId&&t.original_file_id===fid)?.id})):[],source_run_id:operation==="translate"?runId:null,operation,provider:"fixture",model:"synthetic-document-v1",status:"complete",created_at:operation==="transcribe"?"2026-01-01T00:00:00Z":"2026-01-02T00:00:00Z",updated_at:"2026-01-02T00:00:00Z",output:Object.fromEntries(sourceIds.map(fid=>[fid,{uncertainty:["Unclear handwriting is retained literally"],language:operation==="translate"?"en":"fr"}]))});
        for(let n=0;n<4;n++)documentTexts.push({id:crypto.randomUUID(),archive_id:ARCHIVE,item_id:id,document_run_id:rid,original_file_id:sourceIds[n],page_order_snapshot:n,raw_ai_text:operation==="translate"?`English draft page ${n+1}; source remains separate.`:text[n],reviewed_text:null,review_status:"pending",review_revision:0,output_kind:operation==="translate"?"translation":"source",confidence:null,provider:"fixture",model:"synthetic-document-v1",modality:"handwriting",version:operation==="translate"?2:1,processed_at:"2026-01-01T00:00:00Z"});
      }
      for(const suggestion of [{kind:"person",value:"Jan",page:1,evidence:"Jan",context:"mentioned"},{kind:"place",value:"Auroville",page:1,evidence:"Auroville",context:"written_in"},{kind:"date",value:"1978-08-17",page:1,evidence:"17 August 1978",context:"written_date"},{kind:"summary",value:"A letter about family travel.",page:3,evidence:"travel",context:""}])
        documentSuggestions.push({id:crypto.randomUUID(),archive_id:ARCHIVE,item_id:id,document_run_id:runId,source_file_id:sourceIds[suggestion.page-1],field_path:`document.${suggestion.kind}`,status:"pending",suggested_value:suggestion,reviewed_value:null});
      return send(200,{id,runId,translationId,sourceIds,person,place});
    }
    if (address.pathname === "/__fixture/quick-photos" && management) {
      const quickYear=2026+quickSeedCount++;
      const template = imageSets.find(s => s.status === "stored");
      const source = files.find(f => f.id === template.original_file_id);
      const ids = [];
      for (let n=0;n<14;n++) {
        const id=crypto.randomUUID(), originalId=crypto.randomUUID();
        rows.push({...rows.find(r => !r.archived_at),id,kind:"Photograph",title:`Quick photograph ${n+1}`,archived_at:null,split_from:null,
          lifecycle:"active",ingestion_status:"ready",reported_date:"",date_precision:"unknown",reported_place:"",people_text:"",notes:"",catalogued_at:null,created_at:`${quickYear}-12-${String(31-n).padStart(2,"0")}T00:00:00Z`});
        const originalCopy={...source,id:originalId,item_id:id,storage_path:`${ARCHIVE}/${id}/${originalId}`};
        files.push(originalCopy); objects.set(`${source.bucket_id}/${originalCopy.storage_path}`,original);
        const set={...template,id:crypto.randomUUID(),item_id:id,original_file_id:originalId};
        for (const key of ["display_file_id","thumbnail_file_id","small_file_id"]) {
          const old=files.find(f => f.id === template[key]);
          const file={...old,id:crypto.randomUUID(),item_id:id,parent_original_id:originalId};
          file.storage_path=`${ARCHIVE}/${id}/${file.id}`;files.push(file);
          objects.set(`${file.bucket_id}/${file.storage_path}`,objects.get(`${old.bucket_id}/${old.storage_path}`));set[key]=file.id;
        }
        if (n !== 13) imageSets.push(set); // Last test photo deliberately has no prepared small receipt.
        ids.push(id);
      }
      comments.push({id:crypto.randomUUID(),archive_id:ARCHIVE,item_id:ids[0],author_id:"60000000-0000-4000-8000-000000000099",body:"Was this outside the house?",created_at:"2026-01-01T00:00:00Z",parent_id:null,revision:1});
      return send(200,{ids,people,places});
    }
    if (address.pathname === "/__fixture/failure") {
      failList = address.searchParams.get("list") === "1";
      failPreview = address.searchParams.get("preview") === "1";
      failDelete = address.searchParams.get("delete") === "1";
      return send(200, { ok: true });
    }
    if (address.pathname === "/__fixture/person-item" && management) {
      const id = crypto.randomUUID();
      rows.push({
        ...rows.find((r) => !r.archived_at),
        id,
        title: "Two family photographs",
        grouping_kind: "single_object",
        split_from: null,
        archived_at: null,
        lifecycle: "active",
        notes: "Jina-specific shared context",
        people_text: "Jina Allen",
      });
      for (let n = 0; n < 2; n++) {
        const fid = crypto.randomUUID(),
          path = `${ARCHIVE}/${id}/${fid}`;
        files.push({
          ...files.find((f) => f.purpose === "original"),
          id: fid,
          item_id: id,
          storage_path: path,
          original_filename: `IMG_639${n}.HEIC`,
          page_order: n,
        });
        objects.set(`archive-originals/${path}`, original);
      }
      const report = {
        id: crypto.randomUUID(),
        archive_id: ARCHIVE,
        item_id: id,
        person_id: null,
        proposed_by: USER,
        proposed_name: "Jina Allen",
        status: "reported",
        source: "legacy_report",
        created_at: "2026-01-01T00:00:00Z",
      };
      identifications.push(report);
      recollections.push({
        id: crypto.randomUUID(),
        archive_id: ARCHIVE,
        item_id: id,
        original_text: "Jina-specific original words",
        contributor_id: USER,
        recorded_at: "2026-01-01T00:00:00Z",
      });
      return send(200, { id, report, people });
    }
    if (address.pathname === "/__fixture/many" && previewFile && management) {
      const template = imageSets.find((s) => s.status === "stored"),
        source = files.find((f) => f.id === template.original_file_id),
        item = rows.find((r) => r.id === source.item_id);
      for (let n = 0; n < 96; n++) {
        const itemId = crypto.randomUUID(),
          originalId = crypto.randomUUID(),
          setId = crypto.randomUUID();
        rows.push({
          ...item,
          id: itemId,
          title: `Lazy-load photograph ${n}`,
          // Keep the last offscreen card new/uncached, independently of random UUID ordering.
          created_at: new Date(Date.parse(item.created_at) - (n+1)*1000).toISOString(),
          split_from: null,
          archived_at: null,
        });
        const copy = {
          ...source,
          id: originalId,
          item_id: itemId,
          storage_path: `${ARCHIVE}/${itemId}/${originalId}`,
        };
        files.push(copy);
        objects.set(`${copy.bucket_id}/${copy.storage_path}`, original);
        const set = {
          ...template,
          id: setId,
          item_id: itemId,
          original_file_id: originalId,
        };
        for (const key of [
          "display_file_id",
          "thumbnail_file_id",
          "small_file_id",
        ]) {
          const old = files.find((f) => f.id === template[key]);
          const f = {
            ...old,
            id: crypto.randomUUID(),
            item_id: itemId,
            parent_original_id: originalId,
          };
          f.storage_path = `${ARCHIVE}/${itemId}/${f.id}`;
          files.push(f);
          objects.set(
            `${f.bucket_id}/${f.storage_path}`,
            objects.get(`${old.bucket_id}/${old.storage_path}`),
          );
          set[key] = f.id;
        }
        imageSets.push(set);
      }
      return send(200, { ok: true });
    }
    if (address.pathname === "/__fixture/summary")
      return send(200, {
        count: rows.length,
        originalHash: hash,
        attempts: [...attempts.values()],
        imageSets,
        deletions,
        items: rows,
        people,
        places,
        itemPlaces,
        identifications,
        recollections,
        comments,
        documentRuns,
        documentTexts,
        documentSuggestions,
        provenance,
        files,
        displays: files.filter((f) => f.purpose === "display"),
        originalHashes: files
          .filter((f) => f.purpose === "original")
          .map((f) =>
            createHash("sha256")
              .update(objects.get(`${f.bucket_id}/${f.storage_path}`))
              .digest("hex"),
          ),
        conversationRequests: requests.filter(r=>r.path==="/rest/v1/comments"),
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
        if (req.method === "DELETE") {
          if (!management) return send(403, { message: "Editor required" });
          if (failDelete)
            return send(503, { message: "Synthetic delete interruption" });
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const bucket = address.pathname.split("/").pop();
          for (const path of body.prefixes) {
            if (
              !deletions.some(
                (d) =>
                  d.status === "pending" &&
                  d.manifest.some(
                    (f) => f.bucket === bucket && f.path === path,
                  ),
              )
            )
              return send(403, { message: "No confirmed deletion" });
            objects.delete(`${bucket}/${path}`);
          }
          return send(
            200,
            body.prefixes.map((name) => ({ name, bucket_id: bucket })),
          );
        }
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
      if(rpc === "rotate_item_image") {
        const f=files.find(f=>f.id===body.p_source_id&&f.purpose==="original");
        if(!f)return send(403,{code:"42501"});
        if((f.presentation_rotation||0)!==body.p_expected)return send(409,{code:"40001"});
        f.presentation_rotation=((f.presentation_rotation||0)+body.p_turn+360)%360;
        return send(200,f.presentation_rotation);
      }
      function writePlace(details, id) {
        let p = places.find(
          (p) => p.id === id && p.archive_id === body.p_archive_id,
        );
        if (!p) {
          p = {
            id: crypto.randomUUID(),
            archive_id: body.p_archive_id,
            locality: "",
            city: "",
            region: "",
            country: "",
            latitude: null,
            longitude: null,
            notes: "",
            created_by: USER,
            created_at: new Date().toISOString(),
          };
          places.push(p);
        }
        Object.assign(p, details, { updated_at: new Date().toISOString() });
        return p;
      }
      function linkPlace(placeId) {
        const item = rows.find((r) => r.id === body.p_item_id),
          p = places.find(
            (p) => p.id === placeId && p.archive_id === body.p_archive_id,
          );
        if (!item || !p) return null;
        const existing = itemPlaces.find(
          (l) =>
            l.item_id === item.id &&
            l.place_id === p.id &&
            l.role === "primary" &&
            l.status !== "removed",
        );
        if (existing) return existing.id;
        for (const link of itemPlaces.filter(
          (l) =>
            l.item_id === item.id &&
            l.role === "primary" &&
            l.status !== "removed",
        ))
          link.status = "removed";
        const link = {
          id: crypto.randomUUID(),
          archive_id: body.p_archive_id,
          item_id: item.id,
          place_id: placeId,
          role: "primary",
          status: "reported",
          source: body.p_from_report ? "legacy_text" : "human_report",
          reported_text: item.reported_place || "",
          created_by: USER,
          created_at: new Date().toISOString(),
        };
        itemPlaces.push(link);
        provenance.push({
          field_path: "item_place_linked",
          value: {
            link_id: link.id,
            place_id: placeId,
            reported_text: item.reported_place,
            item_contributor_id: item.contributed_by,
          },
        });
        return link.id;
      }
      if (rpc === "document_snapshot") {
        const item=rows.find(r=>r.id===body.p_item_id);
        if(!item || !["Letter","Document","Postcard","Certificate"].includes(item.kind))return send(403,{code:"42501"});
        return send(200,{version:`fixture-document-v${documentVersions.get(item.id)||1}`,pages:files.filter(f=>f.item_id===item.id&&f.purpose==="original").sort((a,b)=>a.page_order-b.page_order).map(f=>({id:f.id,page_order:f.page_order,page_role:f.page_role,sha256:f.sha256}))});
      }
      if (rpc === "review_document_page") {
        const t=documentTexts.find(t=>t.id===body.p_transcription_id);
        if(!t || !management)return send(403,{code:"42501"});
        if(t.review_revision!==body.p_revision)return send(400,{code:"40001"});
        t.reviewed_text=body.p_text;t.review_status="reviewed";t.review_revision++;t.reviewed_at=new Date().toISOString();return send(200,null);
      }
      if (rpc === "apply_document_suggestions") {
        const run=documentRuns.find(r=>r.id===body.p_run_id);
        if(!run || !management)return send(403,{code:"42501"});
        for(const x of body.p_selections) {
          const s=documentSuggestions.find(s=>s.id===x.id&&s.document_run_id===run.id);
          if(!s)return send(400,{code:"P0001"});
          const k=s.suggested_value.kind;
          if(x.action==="accept") {
            if(["person","sender","recipient"].includes(k)) {
              const person=people.find(p=>p.id===x.canonical_id&&p.archive_id===ARCHIVE);if(!person)return send(400,{code:"23503"});
              if(!identifications.some(i=>i.item_id===run.item_id&&i.person_id===person.id))identifications.push({id:crypto.randomUUID(),archive_id:ARCHIVE,item_id:run.item_id,person_id:person.id,proposed_name:person.display_name,proposed_by:USER,status:"accepted",role_context:x.context,created_at:new Date().toISOString()});
            } else if(k==="place") {
              const place=places.find(p=>p.id===x.canonical_id&&p.archive_id===ARCHIVE);if(!place)return send(400,{code:"23503"});
              if(!itemPlaces.some(l=>l.item_id===run.item_id&&l.place_id===place.id&&l.role===x.context))itemPlaces.push({id:crypto.randomUUID(),archive_id:ARCHIVE,item_id:run.item_id,place_id:place.id,role:x.context,status:"confirmed",created_by:USER,source:"human_report",created_at:new Date().toISOString()});
            } else if(k==="date"&&x.context==="written_date") {
              const item=rows.find(i=>i.id===run.item_id);if(JSON.stringify({value:item.reported_date,precision:item.date_precision})!==JSON.stringify(body.p_expected_date))return send(400,{code:"40001"});
              item.reported_date=x.value;item.date_precision=x.precision;
            }
          }
          s.status=x.action==="accept"?"accepted":"rejected";s.reviewed_value=x;s.reviewed_at=new Date().toISOString();
        }return send(200,null);
      }
      if (rpc === "order_document_pages") {
        body.p_ids.forEach((id,n)=>{for(const f of files.filter(f=>f.id===id||f.parent_original_id===id)){f.page_order=n;if(f.id===id)f.page_role=body.p_roles[n];}});
        documentVersions.set(body.p_item_id,(documentVersions.get(body.p_item_id)||1)+1);return send(200,null);
      }
      if (rpc === "save_archive_place")
        return send(200, writePlace(body.p_details, body.p_place_id).id);
      if (rpc === "link_item_place") {
        const id = linkPlace(body.p_place_id);
        return id
          ? send(200, id)
          : send(403, { message: "place_archive_mismatch" });
      }
      if (rpc === "create_item_place") {
        const p = writePlace(body.p_details, null);
        linkPlace(p.id);
        return send(200, p.id);
      }
      if (rpc === "review_item_place") {
        const l = itemPlaces.find((l) => l.id === body.p_link_id);
        l.status = body.p_action === "confirm" ? "confirmed" : "removed";
        return send(200, null);
      }

      if (rpc === "propose_identification") {
        const person = people.find(
          (p) =>
            p.id === body.p_person_id && p.archive_id === body.p_archive_id,
        );
        if (body.p_person_id && !person)
          return send(403, { message: "person_archive_mismatch" });
        const existing = identifications.find(
          (i) =>
            i.item_id === body.p_item_id &&
            i.person_id === person?.id &&
            i.status !== "rejected",
        );
        if (existing) return send(200, existing.id);
        const id = crypto.randomUUID();
        identifications.push({
          id,
          archive_id: body.p_archive_id,
          item_id: body.p_item_id,
          person_id: person?.id || null,
          proposed_by: USER,
          proposed_name: person?.display_name || body.p_name,
          status: "reported",
          source: "human_report",
          created_at: new Date().toISOString(),
        });
        return send(200, id);
      }
      if (rpc === "link_identification") {
        const i = identifications.find(
          (i) => i.id === body.p_identification_id,
        );
        i.person_id = body.p_person_id;
        i.linked_by = USER;
        i.linked_at = new Date().toISOString();
        provenance.push({
          field_path: "identification_linked",
          value: {
            original_proposed_by: i.proposed_by,
            original_reported_name: i.proposed_name,
            original_created_at: i.created_at,
          },
        });
        return send(200, null);
      }
      if (rpc === "review_identification") {
        const i = identifications.find(
          (i) => i.id === body.p_identification_id,
        );
        i.status = body.p_action === "confirm" ? "accepted" : "rejected";
        i.reviewed_by = USER;
        return send(200, null);
      }
      if (rpc === "create_identified_person") {
        const id = crypto.randomUUID();
        people.push({
          id,
          slug: id,
          archive_id: body.p_archive_id,
          display_name: body.p_name,
          category: body.p_category,
          biography: "",
          lifespan: "",
        });
        identifications.push({
          id: crypto.randomUUID(),
          archive_id: body.p_archive_id,
          item_id: body.p_item_id,
          person_id: id,
          proposed_name: body.p_name,
          proposed_by: USER,
          status: "reported",
          source: "human_report",
          created_at: new Date().toISOString(),
        });
        return send(200, id);
      }
      if (rpc === "save_item_field") {
        const item=rows.find(r=>r.id===body.p_item_id && r.archive_id===body.p_archive_id);
        if (!item || !management) return send(403,{code:"42501",message:"permission_denied"});
        const before=body.p_field==="date" ? {value:item.reported_date || "",precision:item.date_precision || "unknown"} : {value:item.title};
        if (JSON.stringify(before)!==JSON.stringify(body.p_expected)) return send(400,{code:"40001",message:"field_changed_reload"});
        if (body.p_field==="date") {item.reported_date=body.p_value;item.date_precision=body.p_precision;} else item.title=body.p_value;
        item.updated_at=new Date().toISOString();return send(200,null);
      }
      if (rpc === "post_item_comment") {
        const item=rows.find(r=>r.id===body.p_item_id && r.archive_id===body.p_archive_id);
        if (!item || item.archived_at || item.lifecycle==="deleting") return send(403,{code:"42501"});
        const existing=comments.find(c=>c.author_id===USER && c.client_write_id===body.p_write_id);
        if (existing) return send(200,existing.id);
        if (body.p_parent_id && !comments.some(c=>c.id===body.p_parent_id && c.item_id===item.id && !c.parent_id && !c.archived_at)) return send(400,{code:"P0001"});
        const id=crypto.randomUUID();comments.push({id,archive_id:item.archive_id,item_id:item.id,author_id:USER,body:body.p_body,created_at:new Date().toISOString(),revision:1,parent_id:body.p_parent_id,client_write_id:body.p_write_id});
        return send(200,id);
      }
      if (rpc === "change_item_comment") {
        const c=comments.find(c=>c.id===body.p_comment_id);
        if (!c || (body.p_action==="edit" && c.author_id!==USER) || (body.p_action!=="edit" && !management)) return send(403,{code:"42501"});
        if (c.revision!==body.p_revision) return send(400,{code:"40001"});
        if (body.p_action==="edit") {c.body=body.p_body;c.edited_at=new Date().toISOString();}
        else c.archived_at=body.p_action==="archive" ? new Date().toISOString() : null;
        c.revision++;return send(200,null);
      }
      if (rpc === "promote_item_comment") {
        const c=comments.find(c=>c.id===body.p_comment_id);
        if (!c || !management || c.archived_at) return send(403,{code:"42501"});
        let r=recollections.find(r=>r.fixture_comment_id===c.id);
        if (!r) {r={id:crypto.randomUUID(),archive_id:c.archive_id,item_id:c.item_id,original_text:c.body,contributor_id:c.author_id,recorded_at:c.created_at,fixture_comment_id:c.id};recollections.push(r);}
        return send(200,r.id);
      }
      if (rpc === "add_recollection") {
        const item = rows.find(r => r.id === body.p_item_id && r.archive_id === body.p_archive_id);
        if (!item || item.lifecycle === "deleting" || item.archived_at)
          return send(403, {code: "42501", message: "permission_denied"});
        const id = crypto.randomUUID();
        recollections.push({id, archive_id: body.p_archive_id, item_id: item.id,
          contributor_id: USER, original_text: body.p_text, recorded_at: new Date().toISOString()});
        return send(200, id);
      }
      if (rpc === "save_catalogue_context") {
        const item = rows.find((r) => r.id === body.p_item_id),
          d = body.p_details;
        Object.assign(item, {
          title: d.title,
          kind: d.kind,
          notes: d.notes,
          people_text: d.people,
          reported_date: d.date,
          date_precision: d.precision,
          reported_place: d.place,
          catalogued_at: new Date().toISOString(),
        });
        if (body.p_recollection)
          recollections.push({
            id: crypto.randomUUID(),
            archive_id: body.p_archive_id,
            item_id: item.id,
            original_text: body.p_recollection,
            recorded_at: new Date().toISOString(),
          });
        return send(200, null);
      }
      if (rpc === "next_uncatalogued_photograph") return send(200, null);

      if (rpc === "reserve_image_set") {
        const original = files.find((f) => f.id === body.p_source_id),
          id = crypto.randomUUID();
        const ids = {
          display: crypto.randomUUID(),
          thumbnail: crypto.randomUUID(),
          small: crypto.randomUUID(),
        };
        for (const key of Object.keys(ids)) {
          const v = body.p_manifest[key];
          files.push({
            ...original,
            id: ids[key],
            parent_original_id: original.id,
            purpose: key === "display" ? "display" : "thumbnail",
            page_role: key,
            original_filename: key,
            mime_type: v.mime,
            byte_size: v.size,
            sha256: v.sha256,
            width: v.width,
            height: v.height,
            status: "reserved",
            bucket_id: "archive-derived",
            storage_path: `${ARCHIVE}/${original.item_id}/${ids[key]}`,
          });
        }
        imageSets.push({
          id,
          archive_id: original.archive_id,
          item_id: original.item_id,
          original_file_id: original.id,
          status: "reserved",
          generator: "responsive-v1",
          manifest: body.p_manifest,
          placeholder: body.p_placeholder,
          display_file_id: ids.display,
          thumbnail_file_id: ids.thumbnail,
          small_file_id: ids.small,
          created_at: new Date().toISOString(),
        });
        return send(200, id);
      }
      if (rpc === "complete_image_set") {
        const set = imageSets.find((s) => s.id === body.p_set_id);
        set.status = "stored";
        for (const id of [
          set.display_file_id,
          set.thumbnail_file_id,
          set.small_file_id,
        ])
          files.find((f) => f.id === id).status = "stored";
        return send(200, null);
      }
      if (rpc === "item_management_snapshot") {
        const item = rows.find((r) => r.id === body.p_item_id);
        if (!management || !item)
          return send(403, { code: "42501", message: "permission_denied" });
        const owned = files.filter((f) => f.item_id === item.id);
        return send(200, {
          item: {
            ...item,
            grouping_kind: item.grouping_kind || "single_object",
            lifecycle: item.lifecycle || "active",
            archived_at: item.archived_at || null,
          },
          files: owned.map((f) => ({
            ...f,
            name: f.original_filename,
            size: f.byte_size,
            mime: f.mime_type,
            bucket: f.bucket_id,
            path: f.storage_path,
          })),
          counts: {
            originals: owned.filter((f) => f.purpose === "original").length,
            derivatives: owned.filter((f) => f.parent_original_id).length,
            recollections: 0,
            comments: 0,
            transcriptions: 0,
            provenance: 0,
          },
          version: "fixture-version",
          children: rows
            .filter((r) => r.split_from === item.id)
            .map((r) => ({ id: r.id, title: r.title })),
          deletion: deletions.find((d) => d.item_id === item.id) || null,
        });
      }
      if (rpc === "set_item_archived") {
        if (!management)
          return send(403, { code: "42501", message: "permission_denied" });
        const item = rows.find((r) => r.id === body.p_item_id);
        item.archived_at = body.p_archived ? new Date().toISOString() : null;
        return send(200, null);
      }
      if (rpc === "begin_item_deletion") {
        if (!management || body.p_confirmation !== "DELETE")
          return send(403, { code: "42501", message: "permission_denied" });
        const previous = deletions.find((d) => d.item_id === body.p_item_id);
        if (previous) return send(200, previous);
        const item = rows.find((r) => r.id === body.p_item_id);
        if (!item?.archived_at)
          return send(400, { code: "P0001", message: "archive_before_delete" });
        const plan = {
          id: crypto.randomUUID(),
          archive_id: ARCHIVE,
          item_id: item.id,
          status: "pending",
          manifest: files
            .filter((f) => f.item_id === item.id)
            .map((f) => ({
              id: f.id,
              bucket: f.bucket_id,
              path: f.storage_path,
            })),
        };
        plan.remaining = plan.manifest;
        deletions.push(plan);
        item.lifecycle = "deleting";
        return send(200, plan);
      }
      if (rpc === "checkpoint_item_deletion") {
        const plan = deletions.find((d) => d.id === body.p_deletion_id);
        plan.remaining = plan.remaining.filter(
          (f) => !body.p_file_ids.includes(f.id),
        );
        return send(200, null);
      }
      if (rpc === "finish_item_deletion") {
        const plan = deletions.find((d) => d.id === body.p_deletion_id);
        if (!management || !plan)
          return send(403, { code: "42501", message: "permission_denied" });
        if (plan.manifest.some((f) => objects.has(`${f.bucket}/${f.path}`)))
          return send(400, {
            code: "P0001",
            message: "storage_cleanup_incomplete",
          });
        for (let i = files.length - 1; i >= 0; i--)
          if (files[i].item_id === plan.item_id) files.splice(i, 1);
        for (let i = imageSets.length - 1; i >= 0; i--)
          if (imageSets[i].item_id === plan.item_id) imageSets.splice(i, 1);
        const index = rows.findIndex((r) => r.id === plan.item_id);
        if (index >= 0) rows.splice(index, 1);
        plan.status = "complete";
        plan.manifest = [];
        return send(200, ARCHIVE);
      }
      if (rpc === "split_photographs") {
        if (!management || body.p_confirmation !== "SPLIT")
          return send(403, { code: "42501", message: "permission_denied" });
        const item = rows.find((r) => r.id === body.p_item_id),
          children = [];
        for (const original of files.filter(
          (f) => f.item_id === item.id && f.purpose === "original",
        )) {
          const child = crypto.randomUUID();
          rows.push({
            ...item,
            id: child,
            title: "Photograph, still to be catalogued",
            split_from: item.id,
            grouping_kind: "separate_photograph",
            archived_at: null,
            notes: "",
            people_text: "",
            reported_date: "",
            reported_place: "",
            catalogued_at: null,
          });
          children.push(child);
          for (const f of files.filter(
            (f) => f.id === original.id || f.parent_original_id === original.id,
          ))
            f.item_id = child;
          for (const set of imageSets.filter(
            (s) => s.original_file_id === original.id,
          ))
            set.item_id = child;
        }
        item.archived_at = new Date().toISOString();
        item.grouping_kind = "split_context";
        return send(200, children);
      }
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
      table === "item_conversation_counts" ? Object.values(comments.filter(c=>!c.archived_at).reduce((all,c)=>{
        all[c.item_id] ||= {archive_id:c.archive_id,item_id:c.item_id,comment_count:0};all[c.item_id].comment_count++;return all;
      },{})) : table === "document_runs" ? documentRuns : table === "transcriptions" ? documentTexts : table === "metadata_suggestions" ? documentSuggestions : table === "comments" ? comments : table === "places"
        ? places
        : table === "item_places"
          ? itemPlaces
          : table === "people"
            ? people
            : table === "identifications"
              ? identifications
              : table === "recollections"
                ? recollections
                : table === "import_batches"
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
                        : table === "image_sets"
                          ? imageSets
                          : table === "current_image_sets"
                            ? currentSets().map(g=>({...g,presentation_rotation:files.find(f=>f.id===g.original_file_id)?.presentation_rotation||0}))
                            : table === "item_deletions"
                              ? deletions
                              : table === "archive_memberships"
                                ? archives.map((a) => ({
                                    id: USER,
                                    archive_id: a.id,
                                    profile_id: USER,
                                    role: management ? "editor" : "contributor",
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
      if (value.startsWith("in.("))
        data = data.filter((row) =>
          value.slice(4, -1).split(",").includes(String(row[key])),
        );
      if (value === "is.null") data = data.filter((row) => row[key] == null);
      if (value === "not.is.null")
        data = data.filter((row) => row[key] != null);
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
