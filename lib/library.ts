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
// that class entirely: saving pack A and unsaving pack B touch different keys
// and cannot clobber each other. The only remaining race is two opposing
// toggles of the SAME pack at the same moment; those resolve last-write-wins
// on that one key, which matches what the user last clicked.
//
// Production must never silently fall back to a local file: on a serverless
// function that file is ephemeral and shared across all users on the same
// warm instance, which would mix libraries and lose saves. If the Blobs path
// is unavailable in production we throw, loudly, instead.

const STORE = "pack-libraries";
const LOCAL_DIR = path.join("/tmp", "packproof-library");

function useLocalStore(): boolean {
  // Explicit opt-in for local testing of a production build.
  if (process.env.PACKPROOF_LOCAL_STORE === "1") return true;
  // Production always uses Netlify Blobs. We deliberately do NOT gate on
  // process.env.NETLIFY: it is not set at function runtime on every Netlify
  // deploy path, and treating that as "local" would silently (or loudly, as
  // before) break the library. If the Blobs store itself is truly
  // unavailable, getStore()/setJSON() throw loudly on their own - no silent
  // fallback to ephemeral shared files either way.
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

// --- public API (unchanged signatures) ---

export async function getLibrary(userId: string): Promise<string[]> {
  if (useLocalStore()) return listLocal(userId);
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  const prefix = `${userId}/`;
  // Without `paginate: true`, list() resolves with the full (unpaginated) set.
  const { blobs } = await store.list({ prefix });
  const slugs: string[] = blobs.map((b) => b.key.slice(prefix.length));
  // Lazy migration from the legacy single-document format (key = userId,
  // value = slug array): fold its entries into per-pack keys, then remove it.
  const legacy = await store.get(userId, { type: "json" });
  if (Array.isArray(legacy)) {
    for (const slug of legacy as string[]) {
      if (!slugs.includes(slug)) {
        slugs.push(slug);
        await store.setJSON(entryKey(userId, slug), { slug, savedAt: new Date().toISOString() });
      }
    }
    await store.delete(userId);
  }
  return slugs.sort();
}

export async function toggleInLibrary(userId: string, slug: string): Promise<string[]> {
  if (useLocalStore()) {
    const current = await listLocal(userId);
    const saved = !current.includes(slug);
    await setLocal(userId, slug, saved);
    return saved ? [...current, slug].sort() : current.filter((s) => s !== slug);
  }
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  const key = entryKey(userId, slug);
  const existing = await store.get(key);
  const saved = existing === null;
  if (saved) {
    // Single-key write: no read-modify-write of shared state.
    await store.setJSON(key, { slug, savedAt: new Date().toISOString() });
  } else {
    await store.delete(key);
  }
  return getLibrary(userId);
}
