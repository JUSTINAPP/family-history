import assert from "node:assert/strict";
export async function placeChecks({
  q,
  asUser,
  asOwner,
  denied,
  users,
  archive,
  otherArchive,
  manifestFile,
}) {
  let checks = 0;
  const eq = (a, b) => {
    assert.deepEqual(a, b);
    checks++;
  };
  const one = async (sql, args = []) => (await q(sql, args)).rows[0];
  const save = "select public.save_archive_place($1,$2,$3::jsonb) id",
    link = "select public.link_item_place($1,$2,$3,$4,$5) id";
  const make = async (count = 1) => {
    const id = (
      await one(
        "select public.begin_ingestion($1,gen_random_uuid(),'Location source','Photograph','Original shared words',$2::jsonb,$3::jsonb) id",
        [
          archive,
          JSON.stringify({
            Where: "Near Auroville, as remembered",
            precision: "unknown",
          }),
          JSON.stringify(
            Array.from({ length: count }, (_, n) => ({
              ...manifestFile,
              name: `where-${n}.png`,
            })),
          ),
        ],
      )
    ).id;
    for (const f of (
      await q("select * from public.archive_item_files where item_id=$1", [id])
    ).rows)
      await q(
        "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
        [
          f.bucket_id,
          f.storage_path,
          JSON.stringify({ size: f.byte_size, mimetype: f.mime_type }),
        ],
      );
    await q("select public.complete_ingestion($1,$2)", [archive, id]);
    return id;
  };
  await asUser(users[4]);
  const place = (
    await one(save, [
      archive,
      null,
      JSON.stringify({
        name: "Auroville",
        region: "Tamil Nadu",
        country: "India",
      }),
    ])
  ).id;
  eq(
    await one(
      "select name,latitude,longitude,created_by from public.places where id=$1",
      [place],
    ),
    {
      name: "Auroville",
      latitude: null,
      longitude: null,
      created_by: users[4],
    },
  );
  await q(save, [
    archive,
    place,
    JSON.stringify({
      name: "Auroville",
      locality: "Village",
      region: "Tamil Nadu",
      country: "India",
      latitude: 12.01,
      longitude: 79.8,
      notes: "Family context",
    }),
  ]);
  eq(
    await one("select locality,latitude,notes from public.places where id=$1", [
      place,
    ]),
    { locality: "Village", latitude: 12.01, notes: "Family context" },
  );
  await denied(save, [
    archive,
    null,
    JSON.stringify({ name: "Bad coordinates", latitude: 100 }),
  ]);
  await asUser(users[1]);
  const foreign = (
    await one(save, [otherArchive, null, JSON.stringify({ name: "Auroville" })])
  ).id;
  eq(foreign === place, false);
  await asUser(users[3]);
  const item = await make();
  await denied(save, [
    archive,
    null,
    JSON.stringify({ name: "General directory write" }),
  ]);
  await denied(link, [archive, item, foreign, "primary", false]);
  const associated = (await one(link, [archive, item, place, "primary", false]))
    .id;
  eq(
    (await one(link, [archive, item, place, "primary", false])).id,
    associated,
  );
  const before = (
    await one("select reported_place from public.archive_items where id=$1", [
      item,
    ])
  ).reported_place;
  eq(before, "Near Auroville, as remembered");
  await denied("select public.review_item_place($1,'confirm')", [associated]);
  await denied(link, [archive, item, place, "sent_to", true]);
  await denied("update public.item_places set place_id=$1 where id=$2", [
    foreign,
    associated,
  ]);
  await asOwner();
  const previousRole = (
    await one(
      "select role from public.archive_memberships where archive_id=$1 and profile_id=$2",
      [archive, users[2]],
    )
  ).role;
  await q(
    "update public.archive_memberships set role='viewer' where archive_id=$1 and profile_id=$2",
    [archive, users[2]],
  );
  await asUser(users[2]);
  await denied(link, [archive, item, place, "primary", false]);
  await denied(save, [archive, null, JSON.stringify({ name: "Viewer Place" })]);
  await denied("select public.review_item_place($1,'remove')", [associated]);
  await asUser(users[4]);
  await q("select public.review_item_place($1,'confirm')", [associated]);
  eq(
    (
      await one("select status from public.item_places where id=$1", [
        associated,
      ])
    ).status,
    "confirmed",
  );
  const editorItem = await make();
  await asUser(users[3]);
  await denied("select public.create_item_place($1,$2,$3::jsonb,false)", [
    archive,
    editorItem,
    JSON.stringify({ name: "Another owner item" }),
  ]);
  await denied("select public.review_item_place($1,'remove')", [associated]);
  const count = (await one("select count(*)::int n from public.places")).n;
  await denied("select public.create_item_place($1,$2,$3::jsonb,false)", [
    archive,
    item,
    JSON.stringify({ name: "Atomic rollback candidate" }),
  ]); // Cannot replace confirmed primary.
  eq((await one("select count(*)::int n from public.places")).n, count);
  await asUser(users[4]);
  await q("select public.review_item_place($1,'remove')", [associated]);
  eq(
    (
      await one("select count(*)::int n from public.places where id=$1", [
        place,
      ])
    ).n,
    1,
  );
  const reportLink = (await one(link, [archive, item, place, "primary", true]))
    .id;
  eq(
    await one(
      "select source,reported_text,created_by from public.item_places where id=$1",
      [reportLink],
    ),
    { source: "legacy_text", reported_text: before, created_by: users[4] },
  );
  eq(
    (
      await one("select reported_place from public.archive_items where id=$1", [
        item,
      ])
    ).reported_place,
    before,
  );
  eq(
    (
      await one(
        "select value->>'reported_text' wording from public.provenance where item_id=$1 and field_path='item_place_linked' order by created_at desc limit 1",
        [item],
      )
    ).wording,
    before,
  );
  await asUser(users[3]);
  const inlineItem = await make();
  const inline = (
    await one("select public.create_item_place($1,$2,$3::jsonb,false) id", [
      archive,
      inlineItem,
      JSON.stringify({ name: "A family home" }),
    ])
  ).id;
  eq(
    (
      await one("select place_id from public.item_places where item_id=$1", [
        inlineItem,
      ])
    ).place_id,
    inline,
  );
  await asUser(users[4]);
  const second = (
    await one(save, [archive, null, JSON.stringify({ name: "Sydney" })])
  ).id;
  await q(link, [archive, item, second, "sent_to", false]);
  eq(
    (
      await one(
        "select count(*)::int n from public.item_places where item_id=$1 and status<>'removed'",
        [item],
      )
    ).n,
    2,
  );
  await q("select public.set_item_archived($1,true)", [item]);
  await asUser(users[3]);
  eq(
    (
      await one(
        "select count(*)::int n from public.item_places where item_id=$1",
        [item],
      )
    ).n,
    0,
  );
  await asUser(users[4]);
  await q("select public.set_item_archived($1,false)", [item]);
  const grouped = await make(2);
  await q(link, [archive, grouped, place, "primary", true]);
  const snap = (
    await one("select public.item_management_snapshot($1) s", [grouped])
  ).s;
  const children = (
    await one("select public.split_photographs($1,$2,'SPLIT') ids", [
      grouped,
      snap.version,
    ])
  ).ids;
  eq(
    (
      await one(
        "select count(*)::int n from public.item_places where item_id=any($1::uuid[])",
        [children],
      )
    ).n,
    0,
  );
  eq(
    (
      await one(
        "select count(*)::int n from public.item_places where item_id=$1 and status<>'removed'",
        [grouped],
      )
    ).n,
    1,
  );
  const version = (
    await one("select public.item_management_snapshot($1) s", [inlineItem])
  ).s.version;
  await q(link, [archive, inlineItem, second, "primary", false]);
  await q("select public.set_item_archived($1,true)", [inlineItem]);
  await denied("select public.begin_item_deletion($1,$2,'DELETE')", [
    inlineItem,
    version,
  ]);
  await asOwner();
  await q(
    "create table public.future_place_dependency(link_id uuid references public.item_places(id))",
  );
  await asUser(users[4]);
  const reviewed = (
    await one("select public.item_management_snapshot($1) s", [inlineItem])
  ).s;
  await denied("select public.begin_item_deletion($1,$2,'DELETE')", [
    inlineItem,
    reviewed.version,
  ]);
  await asOwner();
  await q("drop table public.future_place_dependency");
  await asUser(users[4]);
  const plan = (
    await one("select public.begin_item_deletion($1,$2,'DELETE') p", [
      inlineItem,
      reviewed.version,
    ])
  ).p;
  await denied("select public.create_item_place($1,$2,$3::jsonb,false)", [
    archive,
    inlineItem,
    JSON.stringify({ name: "During deletion" }),
  ]);
  for (const f of plan.manifest)
    await q("delete from storage.objects where bucket_id=$1 and name=$2", [
      f.bucket,
      f.path,
    ]);
  await q("select public.finish_item_deletion($1)", [plan.id]);
  eq(
    (
      await one(
        "select count(*)::int n from public.item_places where item_id=$1",
        [inlineItem],
      )
    ).n,
    0,
  );
  eq(
    (
      await one("select count(*)::int n from public.places where id=$1", [
        inline,
      ])
    ).n,
    1,
  );
  await asUser(users[1]);
  eq(
    (
      await one(
        "select count(*)::int n from public.places where archive_id=$1",
        [archive],
      )
    ).n,
    0,
  );
  eq(
    (
      await one(
        "select count(*)::int n from public.item_places where archive_id=$1",
        [archive],
      )
    ).n,
    0,
  );
  await denied(save, [
    archive,
    place,
    JSON.stringify({ name: "Foreign edit" }),
  ]);
  await asOwner();
  await q(
    "update public.archive_memberships set role=$1 where archive_id=$2 and profile_id=$3",
    [previousRole, archive, users[2]],
  );
  await asUser(users[4]);
  console.log(
    `Place assertions passed: ${checks}; permission denials counted in main suite.`,
  );
  return checks;
}
