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

const STORE = "pack-libraries-v2";
const LOCAL_FILE = path.join("/tmp", "packproof-library.json");
const BLOBS_TIMEOUT_MS = 8000;
const MAX_WRITE_ATTEMPTS = 5;

// NOTE: store name is pack-libraries-v2. The original "pack-libraries"
// store was created by the pre-GitHub-linkage deploy path, and on the linked
// runtime every read against it hangs until timeout (verified via function
// logs 04:02 IST: "Blobs get timed out"). Fresh stores on the same runtime
// answer in ~30-80ms (probe-verified). The old store's data is not lost -
// it remains in "pack-libraries" and can be re-read if Netlify resolves the
// legacy-store access issue.

function useLocalStore(): boolean {
  // Explicit opt-in for local testing of a production build.
  if (process.env.PACKPROOF_LOCAL_STORE === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function withTimeout<T>(p: Promise<T>, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Blobs ${what} timed out after ${BLOBS_TIMEOUT_MS}ms`)), BLOBS_TIMEOUT_MS)
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
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  const slugs = await withTimeout(store.get(userId, { type: "json" }), "get");
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
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
    const res = await withTimeout(store.getWithMetadata(userId, { type: "json" }), "getWithMetadata");
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
      "setJSON"
    );
    if (write.modified) return [...next].sort();
    // modified=false: another writer won the race - re-read and retry.
  }
  throw new Error(`Library update for '${slug}' conflicted ${MAX_WRITE_ATTEMPTS} times in a row; please retry.`);
}
