import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const directory = await mkdtemp(join(tmpdir(), "archive-postgres-"));
let db = new PGlite(directory);
let checks = 0;
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
    .filter((f) => f.endsWith(".sql"))
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
  await denied(reserve, [file.id, "c".repeat(64)]); // changed retry never overwrites a display/source
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
  assert.equal(rls.rows[0].n, 16);
  checks++;
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
