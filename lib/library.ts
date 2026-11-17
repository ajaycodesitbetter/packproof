import { promises as fs } from "fs";
import path from "path";

// Per-user pack library. Production: Netlify Blobs (key/value store included
// with every Netlify site). Local dev ONLY: JSON file fallback so the feature
// is testable without Netlify credentials.
//
// Concurrency design: one JSON document per user, guarded by the Blobs
// compare-and-swap support (etag preconditions: onlyIfMatch / onlyIfNew).
// A write reads the document with its etag, applies the DESIRED state
// (idempotent: "save X" and "unsave X" are explicit, not read-then-toggle),
// and writes only if the etag still matches; a conflict means another tab
// wrote first, so we re-read and retry (bounded). Two concurrent saves of
// different packs therefore both land; two identical operations converge;
// opposing operations on the same pack resolve last-completed-write, which
// matches what the user last clicked. This uses ONLY get/set calls - the
// operations already proven on this site's runtime - no list()/delete().
//
// Every Blobs call is wrapped in a timeout: if the store ever hangs, the
// library fails loudly in seconds instead of hanging the page render.
//
// Production must never silently fall back to a local file: on a serverless
// function that file is ephemeral and shared across all users on the same
// warm instance, which would mix libraries and lose saves. We deliberately do
// NOT gate on process.env.NETLIFY: it is not set at function runtime on every
// Netlify deploy path. Production always uses Blobs; if the store itself is
// truly unavailable, the calls throw loudly on their own.

const STORE = "pack-libraries";
const LOCAL_FILE = path.join("/tmp", "packproof-library.json");
const BLOBS_TIMEOUT_MS = 8000;
const MAX_WRITE_ATTEMPTS = 5;

// NOTE: on the GitHub-linked production runtime, Blobs calls currently hang
// (fail loudly via the timeout guard). The store name stays "pack-libraries"
// so existing saves become visible again as-is when the runtime's Blobs
// access recovers - no data migration needed, format unchanged.

function useLocalStore(): boolean {
  // Explicit opt-in for local testing of a production build.
  if (process.env.PACKPROOF_LOCAL_STORE === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

// Cloudflare deployment: D1 (SQLite) store, selected by the wrangler var.
// One row per (user, pack) save, so writes are single-row atomic and
// idempotent - no read-modify-write document and no CAS retry loop needed.
function useD1Store(): boolean {
  return process.env.PACKPROOF_STORE === "d1";
}

// Vercel (or any Node serverless) deployment: libSQL store (Turso), selected
// by PACKPROOF_STORE=libsql. Same schema and same single-row atomic,
// idempotent write model as the D1 path - migrations/0001_library.sql applies
// unchanged. Turso Free is a hard-stop quota (queries fail with a BLOCKED
// error past the allowance; it never bills the free plan automatically).
function useLibSqlStore(): boolean {
  return process.env.PACKPROOF_STORE === "libsql";
}

interface LibSqlLike {
  execute(q: { sql: string; args: import("@libsql/client").InArgs }): Promise<{ rows: Array<Record<string, unknown>> }>;
}

let libsqlClient: Promise<LibSqlLike> | null = null;

async function getLibSql(): Promise<LibSqlLike> {
  if (libsqlClient) return libsqlClient;
  const pending: Promise<LibSqlLike> = (async () => {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("PACKPROOF_STORE=libsql but TURSO_DATABASE_URL is not set");
    // file: URLs are a local/testing convenience and need the Node entry
    // (native libsql); remote Turso URLs use the fetch-only /web driver,
    // which is what Turso documents for Vercel serverless.
    const mod = url.startsWith("file:")
      ? await import("@libsql/client")
      : await import("@libsql/client/web");
    return mod.createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  })();
  libsqlClient = pending;
  // Never cache a failed init: a bad env var fixed on the next deploy (or a
  // transient import failure) must not poison every later request.
  pending.catch(() => { if (libsqlClient === pending) libsqlClient = null; });
  return pending;
}

interface D1Statement {
  bind(...values: unknown[]): {
    all<T = { slug: string }>(): Promise<{ results: T[] }>;
    run(): Promise<unknown>;
  };
}
interface D1Like {
  prepare(query: string): D1Statement;
}

async function getD1(): Promise<D1Like> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare");
  const ctx = (await getCloudflareContext({ async: true })) as unknown as { env: Record<string, unknown> };
  const db = ctx.env.LIBRARY_DB;
  if (!db) throw new Error("PACKPROOF_STORE=d1 but no LIBRARY_DB binding is configured");
  return db as D1Like;
}

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${what} timed out after ${BLOBS_TIMEOUT_MS}ms`)), BLOBS_TIMEOUT_MS)
    ),
  ]);
}

async function readLocal(): Promise<Record<string, string[]>> {
  let raw: string;
  try {
    raw = await fs.readFile(LOCAL_FILE, "utf8");
  } catch {
    return {}; // file simply absent yet
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Never let a corrupt file be silently treated as empty: the next write
    // would wipe every user's local library. Quarantine and fail loudly.
    await fs.rename(LOCAL_FILE, `${LOCAL_FILE}.corrupt-${Date.now()}`).catch(() => {});
    throw new Error("Local library file is corrupt; quarantined and refusing to overwrite it.");
  }
}

// Serialize local read-modify-write cycles in-process; the tmp+rename keeps
// each write atomic. (Dev-only path - production uses Blobs CAS, which needs
// no mutex.)
let localQueue: Promise<unknown> = Promise.resolve();

async function writeLocal(all: Record<string, string[]>): Promise<void> {
  // Atomic write: tmp file + rename, so a crash mid-write cannot leave a
  // half-written (and then quarantined) store.
  const tmp = `${LOCAL_FILE}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await fs.writeFile(tmp, JSON.stringify(all));
  await fs.rename(tmp, LOCAL_FILE);
}

export async function getLibrary(userId: string): Promise<string[]> {
  if (useLocalStore()) {
    const all = await readLocal();
    return all[userId] ?? [];
  }
  if (useD1Store()) {
    const db = await getD1();
    const { results } = await withTimeout(
      db.prepare("SELECT slug FROM library_saves WHERE user_id = ? ORDER BY slug").bind(userId).all(),
      "d1 select"
    );
    return results.map((r) => r.slug);
  }
  if (useLibSqlStore()) {
    const db = await getLibSql();
    const res = await withTimeout(
      db.execute({ sql: "SELECT slug FROM library_saves WHERE user_id = ? ORDER BY slug", args: [userId] }),
      "libsql select"
    );
    return res.rows.map((r) => String(r.slug));
  }
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  const slugs = await withTimeout(store.get(userId, { type: "json" }), "Blobs get");
  return Array.isArray(slugs) ? (slugs as string[]) : [];
}

export async function setInLibrary(userId: string, slug: string, saved: boolean): Promise<string[]> {
  if (useLocalStore()) {
    const run = localQueue.then(async () => {
      const all = await readLocal();
      const current = all[userId] ?? [];
      const next = saved ? [...new Set([...current, slug])] : current.filter((s) => s !== slug);
      all[userId] = next;
      await writeLocal(all);
      return next;
    });
    localQueue = run.catch(() => {});
    return run;
  }
  if (useD1Store()) {
    const db = await getD1();
    // Atomic, idempotent single-row write: concurrent saves of different
    // packs both land; duplicate saves converge; last unsave wins.
    await withTimeout(
      saved
        ? db.prepare("INSERT OR IGNORE INTO library_saves (user_id, slug) VALUES (?, ?)").bind(userId, slug).run()
        : db.prepare("DELETE FROM library_saves WHERE user_id = ? AND slug = ?").bind(userId, slug).run(),
      "d1 write"
    );
    return getLibrary(userId);
  }
  if (useLibSqlStore()) {
    const db = await getLibSql();
    // Identical write model to the D1 path: single-row INSERT OR IGNORE /
    // DELETE on the (user_id, slug) primary key - atomic and idempotent, so
    // concurrent saves of different packs both land and duplicates converge.
    await withTimeout(
      saved
        ? db.execute({ sql: "INSERT OR IGNORE INTO library_saves (user_id, slug) VALUES (?, ?)", args: [userId, slug] })
        : db.execute({ sql: "DELETE FROM library_saves WHERE user_id = ? AND slug = ?", args: [userId, slug] }),
      "libsql write"
    );
    return getLibrary(userId);
  }
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const res = await withTimeout(store.getWithMetadata(userId, { type: "json" }), "Blobs getWithMetadata");
    const current = Array.isArray(res?.data) ? (res.data as string[]) : [];
    const already = current.includes(slug);
    if (already === saved) {
      // Desired state already holds - idempotent no-op, no write needed.
      return [...current].sort();
    }
    const next = saved ? [...current, slug] : current.filter((s) => s !== slug);
    // Atomic compare-and-swap: write only if nobody else wrote since our read.
    // Missing document is created with onlyIfNew so two concurrent creators
    // cannot both think they succeeded.
    const write = await withTimeout(
      res?.etag
        ? store.setJSON(userId, next, { onlyIfMatch: res.etag })
        : store.setJSON(userId, next, { onlyIfNew: true }),
      "Blobs setJSON"
    );
    if (write.modified) return [...next].sort();
    // modified=false: another writer won the race - re-read and retry.
  }
  throw new Error(`Library update for '${slug}' conflicted ${MAX_WRITE_ATTEMPTS} times in a row; please retry.`);
}
