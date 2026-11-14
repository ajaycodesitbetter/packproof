import { promises as fs } from "fs";
import path from "path";

// Per-user pack library. Production: Netlify Blobs (key/value store included
// with every Netlify site). Local dev: JSON file fallback so the feature is
// testable without Netlify credentials.

const STORE = "pack-libraries";
const LOCAL_FILE = path.join("/tmp", "packproof-library.json");

async function readLocal(): Promise<Record<string, string[]>> {
  try {
    return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function getLibrary(userId: string): Promise<string[]> {
  if (process.env.NETLIFY) {
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
  if (process.env.NETLIFY) {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore(STORE);
    await store.setJSON(userId, next);
    return next;
  }
  const all = await readLocal();
  all[userId] = next;
  await fs.writeFile(LOCAL_FILE, JSON.stringify(all));
  return next;
}
