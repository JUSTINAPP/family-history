import assert from "node:assert/strict";
export async function personChecks({
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
  const eq = (actual, expected) => {
    assert.deepEqual(actual, expected);
    checks++;
  };
  const one = async (sql, args = []) => (await q(sql, args)).rows[0];
  const make = async (count = 1) => {
    const item = (
      await one(
        "select public.begin_ingestion($1,gen_random_uuid(),'Grouped photos','Photograph','Jina-specific original words','{}',$2::jsonb) id",
        [
          archive,
          JSON.stringify(
            Array.from({ length: count }, (_, n) => ({
              ...manifestFile,
              name: `person-${n}.png`,
            })),
          ),
        ],
      )
    ).id;
    const files = (
      await q("select * from public.archive_item_files where item_id=$1", [
        item,
      ])
    ).rows;
    for (const f of files)
      await q(
        "insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3::jsonb)",
        [
          f.bucket_id,
          f.storage_path,
          JSON.stringify({ size: f.byte_size, mimetype: f.mime_type }),
        ],
      );
    await q("select public.complete_ingestion($1,$2)", [archive, item]);
    return item;
  };
  await asUser(users[3]);
  const item = await make(2);
  await asUser(users[4]);
  const jina = (
    await one("select public.save_person($1,'Jina Allen','family') id", [
      archive,
    ])
  ).id;
  const jan = (
    await one("select public.save_person($1,'Jan Allen','family') id", [
      archive,
    ])
  ).id;
  await asUser(users[1]);
  const foreign = (
    await one("select public.save_person($1,'Foreign Person','other') id", [
      otherArchive,
    ])
  ).id;
  const propose = "select public.propose_identification($1,$2,$3,$4) id";
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
  await denied(propose, [archive, item, jina, "Jina Allen"]);
  await denied(
    "select public.create_identified_person($1,$2,'Blocked','family')",
    [archive, item],
  );
  await asUser(users[3]);
  await asOwner();
  const report = (
    await one(
      "insert into public.identifications(archive_id,item_id,proposed_by,proposed_name) values($1,$2,$3,'Jina Allen') returning id",
      [archive, item, users[3]],
    )
  ).id;
  await q(
    "insert into public.metadata_suggestions(archive_id,item_id,field_path,suggested_value,provider,model,confidence) values($1,$2,'person',$3::jsonb,'fixture-only','no-ai-called',0.82)",
    [archive, item, JSON.stringify({ person_id: jina })],
  );
  await asUser(users[3]);
  eq(
    (
      await one("select source from public.identifications where id=$1", [
        report,
      ])
    ).source,
    "legacy_report",
  );
  eq(
    (
      await one(
        "select count(*)::int n from public.identifications where item_id=$1 and person_id is not null",
        [item],
      )
    ).n,
    0,
  );
  const before = await one(
    "select proposed_name,proposed_by,created_at from public.identifications where id=$1",
    [report],
  );
  eq(
    (
      await one("select person_id from public.identifications where id=$1", [
        report,
      ])
    ).person_id,
    null,
  );
  await denied("select public.link_identification($1,$2)", [report, jina]);
  await denied(propose, [archive, item, foreign, "Foreign"]);
  await denied(propose, [archive, item, null, ""]);
  const linked = (
    await one(propose, [archive, item, jan, "arbitrary ignored text"])
  ).id;
  eq((await one(propose, [archive, item, jan, "Jan Allen"])).id, linked);
  await denied("select public.review_identification($1,'confirm')", [linked]);
  const inline = (
    await one(
      "select public.create_identified_person($1,$2,'Jonas Allen','family') id",
      [archive, item],
    )
  ).id;
  eq(
    (
      await one(
        "select person_id from public.identifications where person_id=$1",
        [inline],
      )
    ).person_id,
    inline,
  );
  await asUser(users[4]);
  await denied("select public.link_identification($1,$2)", [report, foreign]);
  await q("select public.link_identification($1,$2)", [report, jina]);
  eq(
    await one(
      "select proposed_name,proposed_by,created_at from public.identifications where id=$1",
      [report],
    ),
    before,
  );
  eq(
    await one(
      "select status,person_id,linked_by from public.identifications where id=$1",
      [report],
    ),
    { status: "reported", person_id: jina, linked_by: users[4] },
  );
  eq(
    (
      await one(
        "select value->>'original_proposed_by' reporter from public.provenance where item_id=$1 and field_path='identification_linked'",
        [item],
      )
    ).reporter,
    users[3],
  );
  eq(
    (
      await one(
        "select count(distinct person_id)::int n from public.identifications where item_id=$1 and person_id is not null and status in ('reported','accepted')",
        [item],
      )
    ).n,
    3,
  );
  await q("select public.review_identification($1,'confirm')", [report]);
  eq(
    await one(
      "select status,reviewed_by from public.identifications where id=$1",
      [report],
    ),
    { status: "accepted", reviewed_by: users[4] },
  );
  await asUser(users[3]);
  await denied("select public.review_identification($1,'remove')", [report]);
  await q("select public.review_identification($1,'remove')", [linked]);
  eq(
    (
      await one("select status from public.identifications where id=$1", [
        linked,
      ])
    ).status,
    "rejected",
  );
  eq(
    (await one("select count(*)::int n from public.people where id=$1", [jan]))
      .n,
    1,
  );
  await denied("update public.identifications set person_id=$1 where id=$2", [
    jan,
    report,
  ]);
  await asUser(users[4]);
  const editorItem = await make();
  await asUser(users[3]);
  await denied(
    "select public.create_identified_person($1,$2,'Not own item','other')",
    [archive, editorItem],
  );
  await asUser(users[4]);
  const version = (
    await one("select public.item_management_snapshot($1) s", [item])
  ).s.version;
  const children = (
    await one("select public.split_photographs($1,$2,'SPLIT') ids", [
      item,
      version,
    ])
  ).ids;
  eq(children.length, 2);
  eq(
    (
      await one(
        "select count(*)::int n from public.identifications where item_id=any($1::uuid[])",
        [children],
      )
    ).n,
    0,
  );
  eq(
    (
      await one(
        "select count(*)::int n from public.recollections where item_id=any($1::uuid[])",
        [children],
      )
    ).n,
    0,
  );
  eq(
    (
      await one(
        "select original_text from public.recollections where item_id=$1",
        [item],
      )
    ).original_text,
    "Jina-specific original words",
  );
  eq(
    (
      await one("select person_id from public.identifications where id=$1", [
        report,
      ])
    ).person_id,
    jina,
  );
  const details = {
    title: "Jina alone",
    kind: "Photograph",
    notes: "Only photo one",
    people: "",
    date: "1965",
    precision: "year",
    place: "India",
  };
  await q(
    "select public.save_catalogue_context($1,$2,$3::jsonb,'New words only for photo one',gen_random_uuid())",
    [archive, children[0], JSON.stringify(details)],
  );
  await q(propose, [archive, children[0], jina, "Jina"]);
  eq(
    await one(
      "select title,reported_date,reported_place,notes,catalogued_at is not null as catalogued from public.archive_items where id=$1",
      [children[0]],
    ),
    {
      title: "Jina alone",
      reported_date: "1965",
      reported_place: "India",
      notes: "Only photo one",
      catalogued: true,
    },
  );
  eq(
    await one(
      "select title,reported_date,reported_place,notes,catalogued_at is null as uncatalogued from public.archive_items where id=$1",
      [children[1]],
    ),
    {
      title: "Photograph, still to be catalogued",
      reported_date: "",
      reported_place: "",
      notes: "",
      uncatalogued: true,
    },
  );
  eq(
    (
      await one(
        "select count(*)::int n from public.identifications where item_id=$1",
        [children[1]],
      )
    ).n,
    0,
  );
  eq(
    (
      await one(
        "select count(*)::int n from public.recollections where item_id=$1",
        [children[1]],
      )
    ).n,
    0,
  );
  eq(
    (
      await one(
        "select count(*)::int n from public.archive_item_files where item_id=any($1::uuid[]) and purpose='original'",
        [children],
      )
    ).n,
    2,
  );
  await q("select public.set_item_archived($1,true)", [children[0]]);
  await asUser(users[2]);
  eq(
    (
      await one(
        "select count(*)::int n from public.identifications where item_id=$1",
        [children[0]],
      )
    ).n,
    0,
  );
  await asUser(users[4]);
  await q("select public.set_item_archived($1,false)", [children[0]]);
  await asOwner();
  await q(
    "update public.archive_items set evidence_status='verified' where id=$1",
    [children[0]],
  );
  await asUser(users[3]);
  await denied(
    "select public.create_identified_person($1,$2,'Verified item','other')",
    [archive, children[0]],
  );
  await asUser(users[1]);
  await denied(propose, [archive, children[0], jina, "foreign caller"]);
  eq(
    (
      await one(
        "select count(*)::int n from public.identifications where item_id=$1",
        [children[0]],
      )
    ).n,
    0,
  );
  await asOwner();
  await q(
    "update public.archive_memberships set role=$1 where archive_id=$2 and profile_id=$3",
    [previousRole, archive, users[2]],
  );
  await asUser(users[4]);
  console.log(
    `Person association assertions passed: ${checks}; additional permission denials counted in main suite.`,
  );
  return checks;
}
