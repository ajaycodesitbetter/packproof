import { promises as fs } from "fs";
import path from "path";

// Per-user pack library. Production: Netlify Blobs (key/value store included
// with every Netlify site). Local dev ONLY: one file per saved pack so the
// feature is testable without Netlify credentials.
//
// Concurrency design: the library is stored as ONE ENTRY PER (user, pack),
// never as a single JSON document per user. Netlify Blobs has no compare-and-
// swap, so a read-modify-write of a shared per-user array can lose updates
// when two tabs save different packs at the same time. Per-pack keys remove
// that class entirely. Writes are DESIRED-STATE and idempotent: "save X"
// writes key X, "unsave X" deletes key X; two identical concurrent operations
// converge, and opposing operations on the same key resolve last-write-wins,
// which matches what the user last clicked. There is no read-then-toggle.
//
// Production must never silently fall back to a local file: on a serverless
// function that file is ephemeral and shared across all users on the same
// warm instance, which would mix libraries and lose saves. We deliberately do
// NOT gate on process.env.NETLIFY: it is not set at function runtime on every
// Netlify deploy path. Production always uses Blobs; if the store itself is
// truly unavailable, getStore()/setJSON() throw loudly on their own.

const STORE = "pack-libraries";
const LOCAL_DIR = path.join("/tmp", "packproof-library");

function useLocalStore(): boolean {
  // Explicit opt-in for local testing of a production build.
  if (process.env.PACKPROOF_LOCAL_STORE === "1") return true;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

function entryKey(userId: string, slug: string): string {
  return `${userId}/${slug}`;
}

// --- local dev fallback: one small file per (user, pack) ---

function localEntry(userId: string, slug: string): string {
  return path.join(LOCAL_DIR, encodeURIComponent(userId), encodeURIComponent(slug));
}

async function listLocal(userId: string): Promise<string[]> {
  let files: string[];
  try {
    files = await fs.readdir(path.join(LOCAL_DIR, encodeURIComponent(userId)));
  } catch {
    return []; // user directory simply absent yet
  }
  return files.map(decodeURIComponent).sort();
}

async function setLocal(userId: string, slug: string, saved: boolean): Promise<void> {
  const file = localEntry(userId, slug);
  if (saved) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    // Atomic write: tmp file + rename, so a crash mid-write cannot leave a
    // half-written entry that reads as a corrupt save.
    const tmp = `${file}.tmp-${process.pid}`;
    await fs.writeFile(tmp, JSON.stringify({ slug, savedAt: new Date().toISOString() }));
    await fs.rename(tmp, file);
  } else {
    await fs.unlink(file).catch(() => {}); // already absent = already unsaved
  }
}

// --- legacy migration ---
// The first deployed format was a single JSON document per user (key =
// userId, value = slug array). Migration runs BEFORE any read result is
// composed and BEFORE any write is applied, so an unsave can never be
// followed by a stale legacy read resurrecting the pack. A slug the user
// unsaved under the legacy format is simply absent from the legacy array, so
// it cannot come back either.

type BlobStore = Awaited<ReturnType<typeof import("@netlify/blobs").getStore>>;

async function migrateLegacy(store: BlobStore, userId: string): Promise<void> {
  const legacy = await store.get(userId, { type: "json" });
  if (!Array.isArray(legacy)) return;
  for (const slug of legacy as string[]) {
    await store.setJSON(entryKey(userId, slug), { slug, savedAt: new Date().toISOString() });
  }
  await store.delete(userId);
}

// --- public API ---

export async function getLibrary(userId: string): Promise<string[]> {
  if (useLocalStore()) return listLocal(userId);
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  await migrateLegacy(store, userId);
  const prefix = `${userId}/`;
  // Without `paginate: true`, list() resolves with the full (unpaginated) set.
  const { blobs } = await store.list({ prefix });
  return blobs.map((b) => b.key.slice(prefix.length)).sort();
}

export async function setInLibrary(userId: string, slug: string, saved: boolean): Promise<string[]> {
  if (useLocalStore()) {
    await setLocal(userId, slug, saved);
    return listLocal(userId);
  }
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  await migrateLegacy(store, userId); // migrate before writing, never after
  const key = entryKey(userId, slug);
  if (saved) {
    // Idempotent desired-state write: no read-modify-write of shared state.
    await store.setJSON(key, { slug, savedAt: new Date().toISOString() });
  } else {
    await store.delete(key);
  }
  return getLibrary(userId);
}
