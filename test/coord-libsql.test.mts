// LibSqlCoordStore against a real (file-backed) libSQL database: the SQL
// itself is under test here. Run: npx tsx test/coord-libsql.test.mts
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { LibSqlCoordStore } from "../lib/discovery-coord";

const db = createClient({ url: "file:/tmp/coord-test.db" });
await db.execute("DROP TABLE IF EXISTS discovery_coord");
await db.execute(readFileSync("migrations/0003_discovery_coord.sql", "utf8"));
const store = new LibSqlCoordStore(async () => db);

let pass = 0, fail = 0;
const assert = (n: string, c: boolean, d?: unknown) =>
  c ? (pass++, console.log(`pass: ${n}`)) : (fail++, console.error(`FAIL: ${n}`, d ?? ""));

const T = 1_800_000_000_000;

// Window cap: 3 granted, 4th denied, new window resets.
assert("claim 1 granted", await store.claimCall(T, 60_000, 3));
assert("claim 2 granted", await store.claimCall(T, 60_000, 3));
assert("claim 3 granted", await store.claimCall(T, 60_000, 3));
assert("claim 4 denied at cap", !(await store.claimCall(T, 60_000, 3)));
assert("next window resets", await store.claimCall(T + 61_000, 60_000, 3));

// Lease: second owner denied, first owner renews, expiry frees it.
assert("owner A takes lease", await store.acquireLease(T, 120_000, "A"));
assert("owner B denied while held", !(await store.acquireLease(T + 1000, 120_000, "B")));
assert("owner A renews", await store.acquireLease(T + 2000, 120_000, "A"));
assert("owner B takes over after expiry", await store.acquireLease(T + 200_000, 120_000, "B"));

// Progress roundtrip.
await store.saveProgress(4, [{ index: 3, ok: true, repos: [{ fullName: "x/y" }] }], T + 300_000);
const prog = await store.loadProgress();
assert("progress roundtrip", prog.next === 4 && (prog.results[0]?.repos[0] as { fullName: string }).fullName === "x/y", prog);

// Cooldown blocks everyone including the previous owner.
await store.finishRefresh(T + 400_000);
assert("cooldown blocks previous owner", !(await store.acquireLease(T + 350_000, 120_000, "B")));
assert("cooldown blocks new owner", !(await store.acquireLease(T + 350_000, 120_000, "C")));
const cleared = await store.loadProgress();
assert("finish clears progress", cleared.next === 0 && cleared.results.length === 0, cleared);
assert("lease free after cooldown", await store.acquireLease(T + 400_001, 120_000, "C"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
