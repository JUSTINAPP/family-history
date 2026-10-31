import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(join(tmpdir(), "archive-postgres-"));
let db = new PGlite(directory);
let checks = 0;
const withAudio = process.env.TEST_WITHOUT_AUDIO !== "true";
const q = (sql, params = []) => db.query(sql, params);
async function denied(sql, params = []) {
  await assert.rejects(() => q(sql, params));
  checks++;
}
const users = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
  "10000000-0000-4000-8000-000000000005",
];
async function asUser(id) {
  await db.exec("reset role; set role authenticated;");
  await q("select set_config('request.jwt.claim.sub',$1,false)", [id || ""]);
}
async function asOwner() {
  await db.exec("reset role");
}
try {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,storage to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;`);
  for (const file of (await readdir("supabase/migrations"))
    .filter(
      (f) => f.endsWith(".sql") && (withAudio || !f.includes("0006_audio")),
    )
    .sort()) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    console.log("Validated migration:", file);
  }
  for (let i = 0; i < users.length; i++)
    await q("insert into auth.users(id,email) values($1,$2)", [
      users[i],
      `test-${i}@example.test`,
    ]);
  await asUser(users[0]);
  const a = (
    await q(
      "select public.create_archive('Test archive A','test-archive-a') as id",
    )
  ).rows[0].id;
  await asUser(users[1]);
  const b = (
    await q(
      "select public.create_archive('Test archive B','test-archive-b') as id",
    )
  ).rows[0].id;
  assert.equal(
    (await q("select count(*)::int as n from public.archives")).rows[0].n,
    1,
  );
  checks++;
  await asOwner();
  for (const [i, role] of [
    [2, "viewer"],
    [3, "contributor"],
    [4, "editor"],
  ])
    await q(
      "insert into public.archive_memberships(archive_id,profile_id,role) values($1,$2,$3)",
      [a, users[i], role],
    );
  await asUser(users[2]);
  await denied(
    "select public.begin_ingestion($1,gen_random_uuid(),'x','Photograph','','{}','[]')",
    [a],
  );
  await denied("select public.save_person($1,'A person','family')", [a]);
  await denied("update public.archives set name=$1 where id=$2", ["forged", a]);
  await asUser(users[4]);
  const person = (
    await q("select public.save_person($1,'Historical person','other') as id", [
      a,
    ])
  ).rows[0].id;
  checks++;
  await asUser(users[3]);
  const capture = "20000000-0000-4000-8000-000000000001";
  const manifest = JSON.stringify([
    {
      name: "source.png",
      size: 12,
      mimeType: "image/png",
      sha256: "a".repeat(64),
      role: "image",
    },
  ]);
  const begin =
    "select public.begin_ingestion($1,$2,'A preserved source','Photograph','A contributor recollection','{}',$3::jsonb) as id";
  const item = (await q(begin, [a, capture, manifest])).rows[0].id;
  const file = (
    await q("select * from public.archive_item_files where item_id=$1", [item])
  ).rows[0];
  assert.equal((await q(begin, [a, capture, manifest])).rows[0].id, item);
  checks++;
  await denied("select public.complete_ingestion($1,$2)", [a, item]);
  await q(
    "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
    [
      file.bucket_id,
      file.storage_path,
      JSON.stringify({ size: 12, mimetype: "image/png" }),
    ],
  );
  checks++;
  await denied(
    "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
    [
      file.bucket_id,
      `${b}/forged`,
      JSON.stringify({ size: 12, mimetype: "image/png" }),
    ],
  );
  await q("select public.complete_ingestion($1,$2)", [a, item]);
  await q("select public.complete_ingestion($1,$2)", [a, item]);
  assert.equal(
    (
      await q(
        "select count(*)::int as n from public.processing_jobs where item_id=$1",
        [item],
      )
    ).rows[0].n,
    1,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select original_text from public.recollections where item_id=$1",
        [item],
      )
    ).rows[0].original_text,
    "A contributor recollection",
  );
  checks++;
  assert.equal(
    (
      await q("update storage.objects set name=$1 where name=$2 returning id", [
        "overwritten",
        file.storage_path,
      ])
    ).rows.length,
    0,
  );
  checks++;
  assert.equal(
    (
      await q("delete from storage.objects where name=$1 returning id", [
        file.storage_path,
      ])
    ).rows.length,
    0,
  );
  checks++;
  await denied("update public.archive_item_files set sha256=$1 where id=$2", [
    "b".repeat(64),
    file.id,
  ]);
  await denied(
    "insert into public.metadata_suggestions(archive_id,item_id,field_path,suggested_value,provider,model) values($1,$2,'date','{}','fake','fake')",
    [a, item],
  );
  await denied(
    "select public.update_item_metadata($1,$2,'Forged title','','','')",
    [a, item],
  );
  await asUser(users[4]);
  await denied(
    "select public.update_item_metadata($1,$2,'Verified title','','','','verified',null)",
    [a, item],
  );
  await q(
    "select public.update_item_metadata($1,$2,'Editor title','','','','family_reported',null)",
    [a, item],
  );
  checks++;
  await asUser(users[1]);
  assert.equal(
    (
      await q(
        "select count(*)::int as n from public.archive_items where id=$1",
        [item],
      )
    ).rows[0].n,
    0,
  );
  checks++;
  assert.equal(
    (
      await q("select count(*)::int as n from storage.objects where name=$1", [
        file.storage_path,
      ])
    ).rows[0].n,
    0,
  );
  checks++;
  await denied("select public.complete_ingestion($1,$2)", [a, item]);
  await asUser(users[2]);
  assert.equal(
    (
      await q(
        "select count(*)::int as n from public.archive_items where id=$1",
        [item],
      )
    ).rows[0].n,
    1,
  );
  checks++;
  await denied("select public.add_recollection($1,$2,'viewer cannot write')", [
    a,
    item,
  ]);
  await asOwner();
  await q(
    "update public.archive_memberships set role='commenter' where archive_id=$1 and profile_id=$2",
    [a, users[2]],
  );
  await asUser(users[2]);
  await q("select public.add_recollection($1,$2,'A new memory')", [a, item]);
  checks++;
  // Follow-up migration: existing sources receive separate private displays; catalogue later.
  const catalogue =
    "select public.catalogue_item($1,$2,'A later caption','Photograph','Later notes','Janice','1965','year','India')";
  const reserve = "select public.reserve_display($1,$2,100,48,32) as id";
  await denied(catalogue, [a, item]); // commenter
  await denied(reserve, [file.id, "b".repeat(64)]);
  await asUser(users[1]);
  await denied(catalogue, [a, item]); // foreign archive admin
  await denied(reserve, [file.id, "b".repeat(64)]);
  await asUser(users[3]);
  await q(catalogue, [a, item]);
  const edited = (
    await q(
      "select last_edited_by,catalogued_at,notes from public.archive_items where id=$1",
      [item],
    )
  ).rows[0];
  assert.equal(edited.last_edited_by, users[3]);
  assert.ok(edited.catalogued_at);
  assert.equal(edited.notes, "Later notes");
  checks++;
  const history = (
    await q(
      "select actor_id,value from public.provenance where item_id=$1 and field_path='catalogue_edit' order by created_at desc limit 1",
      [item],
    )
  ).rows[0];
  assert.equal(history.actor_id, users[3]);
  assert.equal(history.value.before.notes, "");
  assert.equal(history.value.after.notes, "Later notes");
  checks++;

  const displayId = (await q(reserve, [file.id, "b".repeat(64)])).rows[0].id;
  assert.equal(
    (await q(reserve, [file.id, "b".repeat(64)])).rows[0].id,
    displayId,
  );
  checks++;
  // An empty derived reservation may follow improved conversion; no stored bytes can change.
  assert.equal(
    (await q(reserve, [file.id, "c".repeat(64)])).rows[0].id,
    displayId,
  );
  await q(reserve, [file.id, "b".repeat(64)]);
  checks++;
  await denied("select public.complete_display($1)", [displayId]);
  const display = (
    await q("select * from public.archive_item_files where id=$1", [displayId])
  ).rows[0];
  assert.equal(display.parent_original_id, file.id);
  assert.equal(display.bucket_id, "archive-derived");
  assert.equal(display.page_order, file.page_order);
  checks++;
  await q(
    `insert into storage.objects(bucket_id,name,metadata) values($1,$2,'{"size":100,"mimetype":"image/jpeg"}')`,
    [display.bucket_id, display.storage_path],
  );
  await denied(reserve, [file.id, "c".repeat(64)]); // Uploaded derivative is immutable even before its receipt.
  // Recover the contributor's incomplete display receipt as another Editor.
  await asUser(users[4]);
  assert.equal(
    (
      await q("select count(*)::int n from storage.objects where name=$1", [
        display.storage_path,
      ])
    ).rows[0].n,
    1,
  );
  checks++;
  await q("select public.complete_display($1)", [displayId]);
  await q("select public.complete_display($1)", [displayId]);
  await asUser(users[3]);
  assert.equal(
    (
      await q("select status from public.archive_item_files where id=$1", [
        displayId,
      ])
    ).rows[0].status,
    "stored",
  );
  checks++;
  assert.equal(
    (
      await q(
        "select original_text from public.recollections where item_id=$1 order by created_at limit 1",
        [item],
      )
    ).rows[0].original_text,
    "A contributor recollection",
  );
  checks++;
  assert.equal(
    (
      await q("select sha256 from public.archive_item_files where id=$1", [
        file.id,
      ])
    ).rows[0].sha256,
    "a".repeat(64),
  );
  checks++;
  assert.equal(
    (
      await q(
        "with changed as (update storage.objects set metadata='{}' where name=$1 returning *) select count(*)::int n from changed",
        [file.storage_path],
      )
    ).rows[0].n,
    0,
  );
  checks++;
  assert.equal(
    (
      await q(
        "with changed as (delete from storage.objects where name=$1 returning *) select count(*)::int n from changed",
        [file.storage_path],
      )
    ).rows[0].n,
    0,
  );
  checks++;
  await asUser(users[2]);
  assert.equal(
    (
      await q("select count(*)::int n from storage.objects where name=$1", [
        display.storage_path,
      ])
    ).rows[0].n,
    1,
  );
  checks++;
  await denied("select public.complete_display($1)", [displayId]);
  await asUser(users[0]);
  const other = (
    await q(
      "select public.begin_ingestion($1,gen_random_uuid(),'Other contributor','Photograph','','{}',$2::jsonb) as id",
      [a, manifest],
    )
  ).rows[0].id;
  await asUser(users[3]);
  await denied(catalogue, [a, other]);
  // Three metadata-free photographs become three independently ready browseable objects.
  const imported = [];
  for (let index = 0; index < 3; index++) {
    const fresh = (
      await q(
        `select public.begin_ingestion($1,gen_random_uuid(),'Imported photograph','Photograph','','{"precision":"unknown"}',$2::jsonb) as id`,
        [a, manifest],
      )
    ).rows[0].id;
    const original = (
      await q("select * from public.archive_item_files where item_id=$1", [
        fresh,
      ])
    ).rows[0];
    await q(
      `insert into storage.objects(bucket_id,name,metadata) values($1,$2,'{"size":12,"mimetype":"image/png"}')`,
      [original.bucket_id, original.storage_path],
    );
    await q("select public.complete_ingestion($1,$2)", [a, fresh]);
    imported.push(fresh);
  }
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.archive_items where id=any($1::uuid[]) and ingestion_status='ready' and catalogued_at is null and people_text='' and reported_date='' and reported_place=''",
        [imported],
      )
    ).rows[0].n,
    3,
  );
  checks++;
  await asUser(users[4]);
  await q(
    "select public.update_item_metadata($1,$2,'Verified','','','','verified',$3)",
    [a, item, file.id],
  );
  await asUser(users[3]);
  await denied(catalogue, [a, item]);
  await asUser(users[4]);
  await q(catalogue, [a, item]);
  checks++;
  await asOwner();
  await denied(
    "insert into public.archive_memberships(archive_id,profile_id,role,linked_person_id) values($1,$2,$3,$4)",
    [b, users[2], "viewer", person],
  );
  if (withAudio) {
    // Audio: own contribution/edit rules, immutable sources, private links and reversible archiving.
    const audioFile = JSON.stringify({
      name: "voice.m4a",
      mimeType: "audio/mp4",
      size: 32,
      sha256: "d".repeat(64),
      durationMs: 2500,
      originalMime: "audio/mp4",
    });
    const audioBegin =
      "select public.begin_audio_recording($1,$2,$3,$4::jsonb,$5::jsonb,$6::uuid[],$7::uuid[]) id";
    const audioCapture = "30000000-0000-4000-8000-000000000001";
    await asUser(users[2]);
    await denied(audioBegin, [a, audioCapture, item, audioFile, "{}", [], []]); // Commenter cannot create audio.
    await asUser(users[3]);
    const recording = (
      await q(audioBegin, [a, audioCapture, item, audioFile, "{}", [], []])
    ).rows[0].id;
    assert.equal(
      (await q(audioBegin, [a, audioCapture, item, audioFile, "{}", [], []]))
        .rows[0].id,
      recording,
    );
    checks++;
    await asOwner();
    await q(
      "update public.profiles set display_name='Test contributor' where id=$1",
      [users[3]],
    );
    await asUser(users[3]);
    const audioRecollection = (
      await q(
        "select recollection_id from public.recollection_audio where id=$1",
        [recording],
      )
    ).rows[0].recollection_id;
    const audioSource = (
      await q(
        "select f.* from public.archive_item_files f join public.recollection_audio r on r.original_file_id=f.id where r.id=$1",
        [recording],
      )
    ).rows[0];
    assert.equal(audioSource.purpose, "audio_original");
    assert.equal(audioSource.bucket_id, "archive-audio");
    assert.equal(audioSource.item_id, item);
    checks++;
    await denied("select public.complete_audio_recording($1,2500)", [
      recording,
    ]);
    await q(
      "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
      [
        audioSource.bucket_id,
        audioSource.storage_path,
        JSON.stringify({ size: 32, mimetype: "audio/mp4" }),
      ],
    );
    assert.equal(
      (
        await q("select public.complete_audio_recording($1,2500) id", [
          recording,
        ])
      ).rows[0].id,
      item,
    );
    checks++;
    await q("select public.complete_audio_recording($1,2500)", [recording]);
    const audioEdit =
      "select public.edit_audio_recording($1,$2::jsonb,$3::uuid[],$4::uuid[])";
    await q(audioEdit, [
      recording,
      JSON.stringify({
        title: "A memory",
        speaker: "Janice",
        speakerPersonId: person,
        description: "Some context",
        tags: ["interview"],
      }),
      [person],
      [imported[0]],
    ]);
    checks++;
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.audio_item_links where recording_id=$1",
          [recording],
        )
      ).rows[0].n,
      1,
    );
    checks++;
    await denied("select public.archive_audio_recording($1,true)", [recording]);
    await denied(audioEdit, [recording, "{}", [], [b]]); // An archive UUID is not a related item.
    await denied("update public.recollection_audio set title=$1 where id=$2", [
      "forged",
      recording,
    ]);
    await asUser(users[0]);
    await denied(audioEdit, [
      recording,
      JSON.stringify({
        speakerPersonId: "10000000-0000-4000-8000-000000000099",
      }),
      [],
      [],
    ]);
    await asOwner();
    await q(
      "insert into public.archive_memberships(archive_id,profile_id,role) values($1,$2,'contributor')",
      [a, users[1]],
    );
    await asUser(users[1]);
    await denied(audioEdit, [recording, "{}", [], []]); // Another Contributor cannot edit the recording.
    await asOwner();
    await q(
      "update public.archive_memberships set status='removed' where archive_id=$1 and profile_id=$2",
      [a, users[1]],
    );
    await asUser(users[1]);
    assert.equal(
      (
        await q("select count(*)::int n from storage.objects where name=$1", [
          audioSource.storage_path,
        ])
      ).rows[0].n,
      0,
    );
    checks++;
    await asUser(users[2]);
    assert.equal(
      (
        await q("select count(*)::int n from storage.objects where name=$1", [
          audioSource.storage_path,
        ])
      ).rows[0].n,
      1,
    );
    checks++;
    assert.equal(
      (
        await q(
          "select display_name from public.audio_attribution($1) where recording_id=$2",
          [a, recording],
        )
      ).rows[0].display_name,
      "Test contributor",
    );
    checks++;
    await denied(audioEdit, [recording, "{}", [], []]);
    await asUser(users[4]);
    await q(audioEdit, [
      recording,
      JSON.stringify({ title: "Editor context" }),
      [],
      [],
    ]);
    checks++;
    await q("select public.archive_audio_recording($1,true)", [recording]);
    await asUser(users[2]);
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.recollection_audio where id=$1",
          [recording],
        )
      ).rows[0].n,
      0,
    );
    checks++;
    assert.equal(
      (
        await q("select count(*)::int n from storage.objects where name=$1", [
          audioSource.storage_path,
        ])
      ).rows[0].n,
      0,
    );
    checks++;
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.recollections where id=$1",
          [audioRecollection],
        )
      ).rows[0].n,
      0,
    );
    checks++;
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.recollections where item_id=$1 and original_text='A contributor recollection'",
          [item],
        )
      ).rows[0].n,
      1,
    );
    checks++;
    await asUser(users[4]);
    await q("select public.archive_audio_recording($1,false)", [recording]);
    await asUser(users[3]);
    const oral = (
      await q(audioBegin, [
        a,
        "30000000-0000-4000-8000-000000000002",
        null,
        audioFile,
        "{}",
        [],
        [item],
      ])
    ).rows[0].id;
    const oralFile = (
      await q(
        "select f.* from public.archive_item_files f join public.recollection_audio r on r.original_file_id=f.id where r.id=$1",
        [oral],
      )
    ).rows[0];
    await q(
      "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
      [
        oralFile.bucket_id,
        oralFile.storage_path,
        JSON.stringify({ size: 32, mimetype: "audio/mp4" }),
      ],
    );
    const oralItem = (
      await q("select public.complete_audio_recording($1,null) id", [oral])
    ).rows[0].id;
    const oralRow = (
      await q("select * from public.archive_items where id=$1", [oralItem])
    ).rows[0];
    assert.equal(oralRow.kind, "Audio");
    assert.equal(oralRow.ingestion_status, "ready");
    assert.equal(oralRow.title, "Voice recording");
    checks++;
    assert.equal(
      (
        await q(
          "select duration_ms from public.recollection_audio where id=$1",
          [oral],
        )
      ).rows[0].duration_ms,
      2500,
    );
    checks++;
    await denied(audioBegin, [
      a,
      "30000000-0000-4000-8000-000000000003",
      null,
      JSON.stringify({
        name: "bad.svg",
        mimeType: "image/svg+xml",
        size: 1,
        sha256: "e".repeat(64),
      }),
      "{}",
      [],
      [],
    ]);
    assert.equal(
      (
        await q(
          "with changed as (update storage.objects set metadata='{}' where name=$1 returning *) select count(*)::int n from changed",
          [oralFile.storage_path],
        )
      ).rows[0].n,
      0,
    );
    checks++;
    assert.equal(
      (
        await q(
          "with changed as (delete from storage.objects where name=$1 returning *) select count(*)::int n from changed",
          [oralFile.storage_path],
        )
      ).rows[0].n,
      0,
    );
    checks++;
    await asUser(users[4]);
    await q("select public.archive_audio_recording($1,true)", [oral]);
    await asUser(users[2]);
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.archive_items where id=$1",
          [oralItem],
        )
      ).rows[0].n,
      0,
    );
    checks++;
    await asUser(users[4]);
    await q("select public.archive_audio_recording($1,false)", [oral]);
    assert.equal(
      (
        await q("select sha256 from public.archive_item_files where id=$1", [
          oralFile.id,
        ])
      ).rows[0].sha256,
      "d".repeat(64),
    );
    checks++;
  }
  // Explicit photograph batches: 20 sources -> 20 independent objects, never shared recollections.
  await asUser(users[3]);
  const batchId = "50000000-0000-4000-8000-000000000001";
  await q("select public.create_import_batch($1,$2,'Photo box',20)", [
    a,
    batchId,
  ]);
  const batchSources = [];
  for (let i = 0; i < 20; i++) {
    const captureKey = `50000000-0000-4000-8000-${String(i + 100).padStart(12, "0")}`;
    const id = (
      await q("select public.begin_batch_photograph($1,$2,$3,$4::jsonb) id", [
        a,
        batchId,
        captureKey,
        JSON.parse(manifest)[0],
      ])
    ).rows[0].id;
    assert.equal(
      (
        await q("select public.begin_batch_photograph($1,$2,$3,$4::jsonb) id", [
          a,
          batchId,
          captureKey,
          JSON.parse(manifest)[0],
        ])
      ).rows[0].id,
      id,
    );
    const source = (
      await q(
        "select * from public.archive_item_files where item_id=$1 and purpose='original'",
        [id],
      )
    ).rows[0];
    await q(
      "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
      [
        source.bucket_id,
        source.storage_path,
        JSON.stringify({ size: 12, mimetype: "image/png" }),
      ],
    );
    await q("select public.complete_ingestion($1,$2)", [a, id]);
    batchSources.push(id);
  }
  assert.equal(new Set(batchSources).size, 20);
  checks++;
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.import_batch_items where batch_id=$1",
        [batchId],
      )
    ).rows[0].n,
    20,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.recollections where item_id=any($1::uuid[])",
        [batchSources],
      )
    ).rows[0].n,
    0,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.archive_items where id=any($1::uuid[]) and ingestion_status='ready' and catalogued_at is null and notes='' and people_text=''",
        [batchSources],
      )
    ).rows[0].n,
    20,
  );
  checks++;
  await denied(
    "select public.begin_batch_photograph($1,$2,gen_random_uuid(),$3::jsonb)",
    [a, batchId, JSON.parse(manifest)[0]],
  );
  const writeId = "50000000-0000-4000-8000-000000000999";
  const details = JSON.stringify({
    title: "Photograph later catalogued",
    kind: "Photograph",
    notes: "Notes",
    precision: "year",
    date: "1965",
    people: "Janice",
    place: "India",
  });
  await q(
    "select public.save_catalogue_context($1,$2,$3::jsonb,'My own recollection',$4)",
    [a, batchSources[0], details, writeId],
  );
  await q(
    "select public.save_catalogue_context($1,$2,$3::jsonb,'My own recollection',$4)",
    [a, batchSources[0], details, writeId],
  );
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.recollections where item_id=$1",
        [batchSources[0]],
      )
    ).rows[0].n,
    1,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.archive_items where id=any($1::uuid[]) and catalogued_at is null",
        [batchSources],
      )
    ).rows[0].n,
    19,
  );
  checks++;
  const nextPhoto = (
    await q(
      "select i.id from public.archive_items i join public.import_batch_items l on l.item_id=i.id where l.batch_id=$1 and i.catalogued_at is null and i.ingestion_status='ready' order by i.created_at,i.id limit 1",
      [batchId],
    )
  ).rows[0].id;
  assert.notEqual(nextPhoto, batchSources[0]);
  checks++;
  assert.equal(
    (
      await q("select public.next_uncatalogued_photograph($1,$2,$3) id", [
        a,
        batchSources[0],
        batchId,
      ])
    ).rows[0].id,
    nextPhoto,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.list_import_photographs($1,$2)",
        [a, batchId],
      )
    ).rows[0].n,
    20,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.list_import_originals($1,$2)",
        [a, batchId],
      )
    ).rows[0].n,
    20,
  );
  checks++;

  const groupFile = JSON.parse(manifest)[0];
  for (const kind of ["Letter", "Photograph"]) {
    const grouped = (
      await q(
        "select public.begin_ingestion($1,gen_random_uuid(),'One grouped item',$2,'','{}',$3::jsonb) id",
        [
          a,
          kind,
          JSON.stringify([groupFile, { ...groupFile, name: "back.png" }]),
        ],
      )
    ).rows[0].id;
    assert.equal(
      (
        await q(
          "select count(*)::int n from public.archive_item_files where item_id=$1",
          [grouped],
        )
      ).rows[0].n,
      2,
    );
    checks++;
  }
  await asUser(users[2]);
  await denied(
    "select public.create_import_batch($1,gen_random_uuid(),'x',2)",
    [a],
  );
  await denied(
    "select public.begin_batch_photograph($1,$2,gen_random_uuid(),$3::jsonb)",
    [a, batchId, groupFile],
  );
  await asUser(users[1]);
  assert.equal(
    (
      await q("select count(*)::int n from public.import_batches where id=$1", [
        batchId,
      ])
    ).rows[0].n,
    0,
  );
  checks++;
  await asUser(users[4]);
  await q(
    "select public.save_catalogue_context($1,$2,$3::jsonb,'',gen_random_uuid())",
    [a, batchSources[1], details],
  );
  checks++;
  // Retrospective preview retries on two originals attached to one legacy-style item.
  await asUser(users[3]);
  const legacy = (
    await q(
      "select public.begin_ingestion($1,gen_random_uuid(),'Two retained HEIC originals','Photograph','','{}',$2::jsonb) id",
      [a, JSON.stringify([groupFile, { ...groupFile, name: "second.heic" }])],
    )
  ).rows[0].id;
  const legacyFiles = (
    await q(
      "select * from public.archive_item_files where item_id=$1 order by page_order",
      [legacy],
    )
  ).rows;
  for (const f of legacyFiles)
    await q(
      "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
      [
        f.bucket_id,
        f.storage_path,
        JSON.stringify({ size: f.byte_size, mimetype: f.mime_type }),
      ],
    );
  await q("select public.complete_ingestion($1,$2)", [a, legacy]);
  const beginPreview = "select public.begin_preview_attempt($1) token";
  const recordPreview = "select public.record_preview_attempt($1,$2,$3,$4)";
  await asUser(users[2]);
  await denied(beginPreview, [legacyFiles[0].id]); // Commenter.
  await asUser(users[1]);
  await denied(beginPreview, [legacyFiles[0].id]); // Foreign archive admin.
  assert.equal(
    (await q("select count(*)::int n from public.preview_attempts")).rows[0].n,
    0,
  );
  checks++;
  for (const f of legacyFiles) {
    await asUser(users[3]);
    const token = (await q(beginPreview, [f.id])).rows[0].token;
    await denied(beginPreview, [f.id]); // Concurrent attempt cannot overwrite a live lease.
    await denied(recordPreview, [
      f.id,
      "00000000-0000-4000-8000-000000000001",
      "decode",
      null,
    ]);
    await denied(recordPreview, [f.id, token, "decode", "private error text"]);
    await q(recordPreview, [f.id, token, "decode", "decode_failed"]);
    const failed = (
      await q(
        "select * from public.preview_attempts where original_file_id=$1",
        [f.id],
      )
    ).rows[0];
    assert.equal(failed.status, "failed");
    assert.equal(failed.error_code, "decode_failed");
    checks++;
    assert.equal(
      (
        await q(
          "select status from public.processing_jobs where item_id=$1 and stage='create_display_derivatives'",
          [legacy],
        )
      ).rows[0].status,
      "failed",
    );
    checks++;
    await denied(
      "update public.preview_attempts set status='complete' where original_file_id=$1",
      [f.id],
    );
    // Another Editor can retry without changing source ownership or needing a re-upload.
    await asUser(users[4]);
    const retryToken = (await q(beginPreview, [f.id])).rows[0].token;
    await denied(recordPreview, [f.id, token, "complete", null]);
    await denied(recordPreview, [f.id, retryToken, "complete", null]); // Needs a stored derivative receipt.
    const d = (await q(reserve, [f.id, "d".repeat(64)])).rows[0].id;
    const reserved = (
      await q("select * from public.archive_item_files where id=$1", [d])
    ).rows[0];
    await q(
      'insert into storage.objects(bucket_id,name,metadata) values($1,$2,\'{"size":100,"mimetype":"image/jpeg"}\')',
      [reserved.bucket_id, reserved.storage_path],
    );
    await q("select public.complete_display($1)", [d]);
    await q(recordPreview, [f.id, retryToken, "complete", null]);
    const completed = (
      await q(
        "select * from public.preview_attempts where original_file_id=$1",
        [f.id],
      )
    ).rows[0];
    assert.equal(completed.status, "complete");
    assert.equal(completed.attempts, 2);
    checks++;
  }
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.archive_item_files where item_id=$1 and purpose='display' and status='stored'",
        [legacy],
      )
    ).rows[0].n,
    2,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select count(*)::int n from public.archive_item_files where item_id=$1 and purpose='original' and status='stored' and sha256=$2",
        [legacy, groupFile.sha256],
      )
    ).rows[0].n,
    2,
  );
  checks++;
  assert.equal(
    (
      await q(
        "select status from public.processing_jobs where item_id=$1 and stage='create_display_derivatives'",
        [legacy],
      )
    ).rows[0].status,
    "complete",
  );
  checks++;
  // A killed function's lease expires; a stale worker cannot finish the replacement attempt.
  const killedToken = (await q(beginPreview, [legacyFiles[0].id])).rows[0]
    .token;
  await asOwner();
  await q(
    "update public.preview_attempts set started_at=now()-interval '76 seconds' where original_file_id=$1",
    [legacyFiles[0].id],
  );
  await asUser(users[3]);
  const replacement = (await q(beginPreview, [legacyFiles[0].id])).rows[0]
    .token;
  assert.notEqual(killedToken, replacement);
  checks++;
  await denied(recordPreview, [
    legacyFiles[0].id,
    killedToken,
    "decode",
    "decode_failed",
  ]);
  await q(recordPreview, [legacyFiles[0].id, replacement, "complete", null]);
  await asUser(users[0]);
  const owner = (
    await q("select owner_membership_id from public.archives where id=$1", [a])
  ).rows[0].owner_membership_id;
  await denied("select public.manage_member($1,$2,'viewer','active',null)", [
    a,
    owner,
  ]);
  await q(
    "select public.update_archive($1,'Archive A','test-archive-a','','owner_only','{\"defaultRole\":\"viewer\"}',null)",
    [a],
  );
  await asUser(users[3]);
  assert.equal(
    (
      await q(
        "select count(*)::int as n from public.archive_items where archive_id=$1",
        [a],
      )
    ).rows[0].n,
    0,
  );
  checks++;
  await denied(
    "select public.begin_ingestion($1,gen_random_uuid(),'x','Photograph','','{}',$2::jsonb)",
    [a, manifest],
  );
  await asUser(null);
  assert.equal(
    (await q("select count(*)::int as n from public.archives")).rows[0].n,
    0,
  );
  checks++;
  await denied(
    "select public.create_archive('Unauthenticated','unauthenticated')",
  );
  await asOwner();
  const rls = await q(
    "select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and c.relforcerowsecurity",
  );
  assert.equal(rls.rows[0].n, withAudio ? 21 : 19);
  checks++;
  if (!withAudio) {
    await db.exec(
      await readFile(
        "supabase/migrations/202610310006_audio_recordings.sql",
        "utf8",
      ),
    );
    checks++;
    console.log(
      "Audio migration 006 also applies after independent migration 007.",
    );
  }
  await db.close();
  db = new PGlite(directory);
  const after = (
    await q("select sha256,status from public.archive_item_files where id=$1", [
      file.id,
    ])
  ).rows[0];
  assert.equal(after.sha256, "a".repeat(64));
  assert.equal(after.status, "stored");
  checks++;
  console.log(
    `Database checks passed: ${checks}. PostgreSQL migration/RLS/idempotency/restart tests; not a remote Storage integration test.`,
  );
} finally {
  await db.close();
  await rm(directory, { recursive: true, force: true });
}
