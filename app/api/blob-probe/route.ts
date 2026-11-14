import { NextResponse } from "next/server";

// PREVIEW-ONLY diagnostic: times each Blobs operation used by the library
// against a throwaway probe key, with hard timeouts, so we can see which call
// (if any) hangs on this runtime without touching production or user data.
export async function GET() {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("pack-libraries-probe");
  const out: Record<string, string> = {};
  const time = async (name: string, p: Promise<unknown>) => {
    const t0 = Date.now();
    try {
      const r = await Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT-8s")), 8000)),
      ]);
      out[name] = `ok ${Date.now() - t0}ms ${JSON.stringify(r)?.slice(0, 80)}`;
    } catch (e) {
      out[name] = `ERR ${Date.now() - t0}ms ${String(e).slice(0, 120)}`;
    }
  };
  const key = `probe/${Date.now()}`;
  await time("setJSON_new", store.setJSON(key, ["a"]));
  await time("get", store.get(key, { type: "json" }));
  const wm = await store.getWithMetadata(key, { type: "json" }).catch(() => null);
  out["getWithMetadata"] = wm ? `ok etag=${wm.etag?.slice(0, 12)}` : "null";
  if (wm?.etag) {
    await time("setJSON_onlyIfMatch", store.setJSON(key, ["a", "b"], { onlyIfMatch: wm.etag }));
    await time("setJSON_onlyIfMatch_stale", store.setJSON(key, ["x"], { onlyIfMatch: "stale-etag" }));
  }
  await time("setJSON_onlyIfNew_existing", store.setJSON(key, ["y"], { onlyIfNew: true }));
  await time("list", store.list({ prefix: "probe/" }));
  await time("delete", store.delete(key));
  return NextResponse.json(out);
}

// Trigger branch deploy.
