import { promises as fs } from "fs";
import path from "path";

// Per-user pack library. Production: Netlify Blobs (key/value store included
// with every Netlify site). Local dev ONLY: JSON file fallback so the feature
// is testable without Netlify credentials.
//
// Production must never silently fall back to a local file: on a serverless
// function that file is ephemeral and shared across all users on the same
// warm instance, which would mix libraries and lose saves. If the Blobs path
// is unavailable in production we throw, loudly, instead.

const STORE = "pack-libraries";
const LOCAL_FILE = path.join("/tmp", "packproof-library.json");

function useLocalStore(): boolean {
  if (process.env.NETLIFY) return false;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Library store unavailable: NETLIFY env not set in a production build - refusing to fall back to shared local storage."
    );
  }
  return true;
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

async function writeLocal(all: Record<string, string[]>): Promise<void> {
  // Atomic write: tmp file + rename, so a crash mid-write cannot leave a
  // half-written (and then quarantined) store.
  const tmp = `${LOCAL_FILE}.tmp-${process.pid}`;
  await fs.writeFile(tmp, JSON.stringify(all));
  await fs.rename(tmp, LOCAL_FILE);
}

export async function getLibrary(userId: string): Promise<string[]> {
  if (!useLocalStore()) {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(STORE);
    const slugs = await store.get(userId, { type: "json" });
    return Array.isArray(slugs) ? (slugs as string[]) : [];
  }
  const all = await readLocal();
  return all[userId] ?? [];
}

export async function toggleInLibrary(userId: string, slug: string): Promise<string[]> {
  const current = await getLibrary(userId);
  const next = current.includes(slug)
    ? current.filter((s) => s !== slug)
    : [...current, slug];
  if (!useLocalStore()) {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(STORE);
    await store.setJSON(userId, next);
    return next;
  }
  const all = await readLocal();
  all[userId] = next;
  await writeLocal(all);
  return next;
}
