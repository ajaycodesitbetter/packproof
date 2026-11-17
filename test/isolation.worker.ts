// Local-only test harness (never deployed): drives the REAL lib/library.ts D1
// code path with two synthetic identities against a local D1 (SQLite) database.
// NODE_ENV is set to "production" here because the production Next build inlines
// it that way; wrangler dev does not, and the shipped code would otherwise pick
// its dev-only local-file store.
import { getLibrary, setInLibrary } from "../lib/library";

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    process.env.PACKPROOF_STORE = "d1";
    (globalThis as any)[Symbol.for("__cloudflare-context__")] = { env, cf: (request as any).cf, ctx };
    const url = new URL(request.url);
    const user = url.searchParams.get("user") ?? "";
    try {
      if (url.pathname === "/save") {
        const slug = url.searchParams.get("slug") ?? "";
        const saved = url.searchParams.get("saved") !== "false";
        const slugs = await setInLibrary(user, slug, saved);
        return Response.json({ slugs });
      }
      if (url.pathname === "/get") {
        return Response.json({ slugs: await getLibrary(user) });
      }
      return new Response("not found", { status: 404 });
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  },
};
