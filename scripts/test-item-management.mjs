import assert from "node:assert/strict";
export async function managementChecks({
  q,
  asUser,
  asOwner,
  denied,
  users,
  archive,
  legacy,
  legacyFiles,
  manifestFile,
  person,
  withAudio,
}) {
  let checks = 0;
  const check = (value, expected) => {
    assert.deepEqual(value, expected);
    checks++;
  };
  const snapshot = async (id) =>
    (await q("select public.item_management_snapshot($1) s", [id])).rows[0].s;
  await asUser(users[3]);
  const batch = (
    await q(
      "select public.create_import_batch($1,gen_random_uuid(),'Three independent photos',3) id",
      [archive],
    )
  ).rows[0].id;
  const three = [];
  for (let n = 1; n <= 3; n++) {
    const id = (
      await q(
        "select public.begin_batch_photograph($1,$2,gen_random_uuid(),$3::jsonb) id",
        [
          archive,
          batch,
          JSON.stringify({
            ...manifestFile,
            name: `photo-${n}.png`,
            sha256: String(n).repeat(64),
          }),
        ],
      )
    ).rows[0].id;
    three.push(id);
    const f = (
      await q("select * from public.archive_item_files where item_id=$1", [id])
    ).rows;
    check(f.length, 1);
    check(f[0].sha256, String(n).repeat(64));
    await q(
      "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
      [
        f[0].bucket_id,
        f[0].storage_path,
        JSON.stringify({ size: f[0].byte_size, mimetype: f[0].mime_type }),
      ],
    );
    await q("select public.complete_ingestion($1,$2)", [archive, id]);
  }
  check(new Set(three).size, 3);
  await q(
    "select public.catalogue_item($1,$2,'Only photo one','Photograph','','Janice','1965','year','India')",
    [archive, three[0]],
  );
  check(
    (
      await q(
        "select title,reported_date,catalogued_at is null as uncatalogued from public.archive_items where id=$1",
        [three[1]],
      )
    ).rows[0],
    {
      title: "Photograph, still to be catalogued",
      reported_date: "",
      uncatalogued: true,
    },
  );
  check(
    (
      await q(
        "select count(*)::int n from public.archive_items where id=any($1::uuid[]) and grouping_kind='separate_photograph'",
        [three],
      )
    ).rows[0].n,
    3,
  );
  await asOwner();
  await denied(
    "insert into public.import_batch_items(archive_id,batch_id,item_id) values($1,$2,$3)",
    [archive, batch, legacy],
  );
  await asUser(users[3]);
  const before = (
    await q(
      "select id,storage_path,sha256,byte_size from public.archive_item_files where item_id=$1 and purpose='original' order by id",
      [legacy],
    )
  ).rows;
  const variants = {
    display: {
      size: 100,
      width: 48,
      height: 32,
      mime: "image/jpeg",
      sha256: "e".repeat(64),
    },
    thumbnail: {
      size: 50,
      width: 32,
      height: 22,
      mime: "image/webp",
      sha256: "f".repeat(64),
    },
    small: {
      size: 30,
      width: 16,
      height: 11,
      mime: "image/webp",
      sha256: "1".repeat(64),
    },
  };
  const reserve = "select public.reserve_image_set($1,$2::jsonb,$3) id";
  const set = (
    await q(reserve, [
      legacyFiles[0].id,
      JSON.stringify(variants),
      "data:image/webp;base64,AAAA",
    ])
  ).rows[0].id;
  check(
    (
      await q(reserve, [
        legacyFiles[0].id,
        JSON.stringify(variants),
        "data:image/webp;base64,AAAA",
      ])
    ).rows[0].id,
    set,
  );
  await denied("select public.complete_image_set($1)", [set]);
  const setRow = (await q("select * from public.image_sets where id=$1", [set]))
    .rows[0];
  const assets = (
    await q(
      "select * from public.archive_item_files where id=any($1::uuid[])",
      [
        [
          setRow.display_file_id,
          setRow.thumbnail_file_id,
          setRow.small_file_id,
        ],
      ],
    )
  ).rows;
  check(assets.length, 3);
  check(
    assets.every(
      (f) =>
        f.bucket_id === "archive-derived" &&
        f.parent_original_id === legacyFiles[0].id,
    ),
    true,
  );
  for (const f of assets)
    await q(
      "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
      [
        f.bucket_id,
        f.storage_path,
        JSON.stringify({ size: f.byte_size, mimetype: f.mime_type }),
      ],
    );
  await q("select public.complete_image_set($1)", [set]);
  check(
    (await q("select status from public.image_sets where id=$1", [set])).rows[0]
      .status,
    "stored",
  );
  await asOwner();
  check(
    (
      await q(
        "select bool_and(not public) private from storage.buckets where id in ('archive-originals','archive-derived')",
      )
    ).rows[0].private,
    true,
  );
  await asUser(users[3]);
  await q(
    "select public.catalogue_item($1,$2,'Unresolved shared caption','Photograph','Shared notes','A shared name','1960','approximate','Shared place')",
    [archive, legacy],
  );
  await q(
    "select public.add_recollection($1,$2,'A shared memory, attribution unresolved')",
    [archive, legacy],
  );
  await denied("select public.set_item_archived($1,true)", [legacy]);
  const split = "select public.split_photographs($1,$2,$3) ids";
  await denied(split, [legacy, "wrong", "SPLIT"]);
  await asUser(users[4]);
  await q("select public.set_item_archived($1,true)", [legacy]);
  check(
    (
      await q(
        "select count(*)::int n from public.archive_items where id=$1 and archived_at is null",
        [legacy],
      )
    ).rows[0].n,
    0,
  );
  await asUser(users[3]);
  check(
    (
      await q("select count(*)::int n from public.archive_items where id=$1", [
        legacy,
      ])
    ).rows[0].n,
    0,
  );
  check(
    (
      await q("select count(*)::int n from storage.objects where name=$1", [
        legacyFiles[0].storage_path,
      ])
    ).rows[0].n,
    0,
  );
  await asUser(users[4]);
  await q("select public.set_item_archived($1,false)", [legacy]);
  check(
    (
      await q(
        "select count(*)::int n from public.archive_items where id=$1 and archived_at is null",
        [legacy],
      )
    ).rows[0].n,
    1,
  );
  const reviewed = await snapshot(legacy);
  await denied(split, [legacy, reviewed.version, "YES"]);
  await denied(split, [legacy, "stale", "SPLIT"]);
  const objectCount = (await q("select count(*)::int n from storage.objects"))
    .rows[0].n;
  const children = (await q(split, [legacy, reviewed.version, "SPLIT"])).rows[0]
    .ids;
  check(children.length, 2);
  const after = (
    await q(
      "select id,storage_path,sha256,byte_size from public.archive_item_files where item_id=any($1::uuid[]) and purpose='original' order by id",
      [children],
    )
  ).rows;
  check(after, before);
  check(
    (await q("select count(*)::int n from storage.objects")).rows[0].n,
    objectCount,
  );
  for (const id of children) {
    const row = (
      await q("select * from public.archive_items where id=$1", [id])
    ).rows[0];
    check(
      [
        row.notes,
        row.people_text,
        row.reported_date,
        row.reported_place,
        row.catalogued_at,
      ],
      ["", "", "", "", null],
    );
    check(
      (
        await q(
          "select count(*)::int n from public.archive_item_files where item_id=$1 and purpose='original'",
          [id],
        )
      ).rows[0].n,
      1,
    );
  }
  check(
    (
      await q(
        "select count(*)::int n from public.recollections where item_id=$1",
        [legacy],
      )
    ).rows[0].n,
    1,
  );
  check(
    (
      await q(
        "select count(*)::int n from public.recollections where item_id=any($1::uuid[])",
        [children],
      )
    ).rows[0].n,
    0,
  );
  check(
    (
      await q("select grouping_kind from public.archive_items where id=$1", [
        legacy,
      ])
    ).rows[0].grouping_kind,
    "split_context",
  );
  const child = (
    await q("select item_id from public.archive_item_files where id=$1", [
      legacyFiles[0].id,
    ])
  ).rows[0].item_id;
  check(
    (await q("select item_id from public.image_sets where id=$1", [set]))
      .rows[0].item_id,
    child,
  );
  check(
    (
      await q(
        "select count(*)::int n from public.archive_item_files d join public.archive_item_files s on s.id=d.parent_original_id where s.item_id=any($1::uuid[]) and d.item_id<>s.item_id",
        [children],
      )
    ).rows[0].n,
    0,
  );
  await denied("select public.set_item_archived($1,false)", [legacy]);
  const deletion = "select public.begin_item_deletion($1,$2,$3) plan";
  await denied(deletion, [legacy, (await snapshot(legacy)).version, "DELETE"]);
  await denied(deletion, [child, (await snapshot(child)).version, "DELETE"]); // Archive first.
  // Attach an audio master, its credit/link rows and source recollection to test full dependent cleanup.
  if (withAudio) {
    const recording = (
      await q(
        "select public.begin_audio_recording($1,gen_random_uuid(),$2,$3::jsonb,'{}'::jsonb,$4::uuid[],$5::uuid[]) id",
        [
          archive,
          child,
          JSON.stringify({
            name: "attached.webm",
            size: 12,
            mimeType: "audio/webm",
            sha256: "b".repeat(64),
            role: "audio",
          }),
          [person],
          [children.find((id) => id !== child)],
        ],
      )
    ).rows[0].id;
    const f = (
      await q(
        "select f.* from public.archive_item_files f join public.recollection_audio r on r.original_file_id=f.id where r.id=$1",
        [recording],
      )
    ).rows[0];
    await q(
      "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
      [
        f.bucket_id,
        f.storage_path,
        JSON.stringify({ size: f.byte_size, mimetype: f.mime_type }),
      ],
    );
    await q("select public.complete_audio_recording($1,1000)", [recording]);
  }
  await asOwner();
  await q("update public.archives set cover_file_id=$1 where id=$2", [
    legacyFiles[0].id,
    archive,
  ]);
  await q("update public.people set portrait_file_id=$1 where id=$2", [
    legacyFiles[0].id,
    person,
  ]);
  await q(
    "update public.preview_attempts set updated_at=now()-interval '76 seconds' where item_id=$1",
    [child],
  );
  await asUser(users[4]);
  await q("select public.set_item_archived($1,true)", [child]);
  const plan = await snapshot(child);
  await denied(deletion, [child, plan.version, "delete"]);
  await denied(deletion, [child, "stale", "DELETE"]);
  await asOwner();
  await q(
    "create table public.future_dependency(item_id uuid references public.archive_items(id))",
  );
  await asUser(users[4]);
  await denied(deletion, [child, plan.version, "DELETE"]);
  await asOwner();
  await q("drop table public.future_dependency");
  await asUser(users[3]);
  await denied(deletion, [child, plan.version, "DELETE"]);
  await asUser(users[4]);
  const started = (await q(deletion, [child, plan.version, "DELETE"])).rows[0]
    .plan;
  check(
    (await q(deletion, [child, "retry", "DELETE"])).rows[0].plan.id,
    started.id,
  );
  await denied("select public.finish_item_deletion($1)", [started.id]);
  await denied(
    "select public.catalogue_item($1,$2,'Late write','Photograph','','','','unknown','')",
    [archive, child],
  );
  await asUser(users[3]);
  const wrongDelete = await q(
    "delete from storage.objects where name=$1 returning id",
    [legacyFiles[0].storage_path],
  );
  check(wrongDelete.rows.length, 0);
  await asUser(users[4]);
  check(
    (
      await q("delete from storage.objects where name=$1 returning id", [
        legacyFiles[1].storage_path,
      ])
    ).rows.length,
    0,
  );
  const first = started.manifest[0];
  await denied("select public.checkpoint_item_deletion($1,$2::uuid[])", [
    started.id,
    [first.id],
  ]);
  await q("delete from storage.objects where bucket_id=$1 and name=$2", [
    first.bucket,
    first.path,
  ]);
  await q("select public.checkpoint_item_deletion($1,$2::uuid[])", [
    started.id,
    [first.id],
  ]);
  check(
    (
      await q(
        "select jsonb_array_length(remaining)::int n from public.item_deletions where id=$1",
        [started.id],
      )
    ).rows[0].n,
    started.manifest.length - 1,
  );
  for (const f of started.manifest)
    await q("delete from storage.objects where bucket_id=$1 and name=$2", [
      f.bucket,
      f.path,
    ]); // Emulates Storage API metadata cleanup in this disposable DB only.
  await q("select public.finish_item_deletion($1)", [started.id]);
  await q("select public.finish_item_deletion($1)", [started.id]);
  check(
    (
      await q("select count(*)::int n from public.archive_items where id=$1", [
        child,
      ])
    ).rows[0].n,
    0,
  );
  for (const table of [
    "archive_item_files",
    "recollections",
    "provenance",
    "preview_attempts",
    "image_sets",
    "processing_jobs",
    "import_batch_items",
  ])
    check(
      (
        await q(
          `select count(*)::int n from public.${table} where item_id=$1`,
          [child],
        )
      ).rows[0].n,
      0,
    );
  check(
    (
      await q("select portrait_file_id from public.people where id=$1", [
        person,
      ])
    ).rows[0].portrait_file_id,
    null,
  );
  check(
    (
      await q("select cover_file_id from public.archives where id=$1", [
        archive,
      ])
    ).rows[0].cover_file_id,
    null,
  );
  const finished = (
    await q("select status,manifest from public.item_deletions where id=$1", [
      started.id,
    ])
  ).rows[0];
  check(finished, { status: "complete", manifest: [] });
  check(
    (
      await q(
        "select count(*)::int n from public.archive_item_files where id=$1 and sha256=$2",
        [legacyFiles[1].id, manifestFile.sha256],
      )
    ).rows[0].n,
    1,
  );
  check(
    (
      await q(
        "select count(*)::int n from public.recollections where item_id=$1",
        [legacy],
      )
    ).rows[0].n,
    1,
  );
  return checks;
}
