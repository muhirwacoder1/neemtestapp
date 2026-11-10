import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
test("database policies isolate profiles, reject privilege changes and validate transactional writes", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon,service_role; grant execute on function auth.uid() to authenticated,anon,service_role;`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610210001_neem.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const a = "11111111-1111-4111-8111-111111111111",
      b = "22222222-2222-4222-8222-222222222222";
    await db.query(
      `insert into auth.users(id,raw_user_meta_data) values($1,'{"name":"First"}'),($2,'{"name":"Second"}')`,
      [a, b],
    );
    const profiles = await db.query<{ id: string; owner_id: string }>(
      "select id,owner_id from public.profiles",
    );
    const first = profiles.rows.find((p) => p.owner_id === a)!.id,
      second = profiles.rows.find((p) => p.owner_id === b)!.id;
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [a]);
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from public.profiles where id=$1", [second]))
        .rows.length,
      0,
    );
    await assert.rejects(() =>
      db.query(
        `insert into public.profile_members(profile_id,user_id,role) values($1,$2,'owner')`,
        [second, a],
      ),
    );
    await assert.rejects(() =>
      db.query(`update public.profiles set owner_id=$1 where id=$2`, [
        b,
        first,
      ]),
    );
    await assert.rejects(() =>
      db.query(
        `insert into public.subscriptions(id,profile_id,status,provider,expires_at) values('fake',$1,'active','client',now()+interval '1 day')`,
        [first],
      ),
    );
    const write = (
      profile: string,
      records: unknown[],
      tasks: unknown[] = [],
    ) =>
      db.query("select public.save_profile_changes($1,$2,$3,$4,$5,$6)", [
        profile,
        JSON.stringify(records),
        JSON.stringify(tasks),
        "{}",
        "[]",
        "{}",
      ]);
    const record = {
      id: "record",
      kind: "pressure",
      value: 120,
      secondary: 80,
      at: new Date(Date.now() - 60000).toISOString(),
      context: "At rest",
      source: "manual",
    };
    await write(first, [record]);
    assert.equal(
      (await db.query("select * from public.health_records")).rows.length,
      1,
    );
    await assert.rejects(() =>
      write(second, [{ ...record, id: "cross-profile" }]),
    );
    await assert.rejects(() =>
      write(first, [{ ...record, id: "demo", source: "demo" }]),
    );
    await assert.rejects(() =>
      write(first, [{ ...record, id: "invalid", value: 70, secondary: 90 }]),
    );
    // A failed record prevents the task in the same transaction from being written.
    await assert.rejects(() =>
      write(
        first,
        [{ ...record, id: "atomic", value: 70, secondary: 90 }],
        [
          {
            id: "should-not-exist",
            title: "A task",
            dueAt: new Date().toISOString(),
          },
        ],
      ),
    );
    assert.equal(
      (await db.query("select * from public.care_tasks")).rows.length,
      0,
    );
    await write(
      first,
      [],
      [{ id: "task", title: "Check feet", dueAt: new Date().toISOString() }],
    );
    await write(
      first,
      [],
      [
        {
          id: "task",
          title: "Check feet",
          dueAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      ],
    );
    assert.ok(
      (
        await db.query<{ completed_at: string }>(
          "select completed_at from public.care_tasks",
        )
      ).rows[0].completed_at,
    );
    await db.exec("reset role");
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [b]);
    await db.exec("set role authenticated");
    assert.equal(
      (await db.query("select * from public.health_records")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.care_tasks")).rows.length,
      0,
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(() => db.query("select * from public.health_records"));
  } finally {
    await db.close();
  }
});
