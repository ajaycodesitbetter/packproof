interface LibraryDependencies {
  identity: () => Promise<string | null>;
  getLibrary: (id: string) => Promise<string[]>;
  setInLibrary: (id: string, slug: string, saved: boolean) => Promise<string[]>;
  knownSlug: (slug: string) => boolean;
  reportFailure: (operation: "read" | "write") => void;
}
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
export function createLibraryHandlers(d: LibraryDependencies) {
  return {
    async GET() {
      const id = await d.identity();
      if (!id) return json({ error: "sign in required" }, 401);
      try { return json({ slugs: await d.getLibrary(id) }); }
      catch { d.reportFailure("read"); return json({ error: "library unavailable" }, 503); }
    },
    async POST(req: Request) {
      const id = await d.identity();
      if (!id) return json({ error: "sign in required" }, 401);
      // Auth.js protects its own endpoints. This custom write also checks the
      // browser's Origin and fetch metadata; a session alone is not CSRF protection.
      const origin = req.headers.get("origin");
      if (!origin || origin !== new URL(req.url).origin || req.headers.get("sec-fetch-site") === "cross-site") return json({ error: "same-origin request required" }, 403);
      if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") ?? "")) return json({ error: "application/json required" }, 415);
      if (Number(req.headers.get("content-length") ?? 0) > 2048) return json({ error: "request too large" }, 413);
      let body: unknown;
      try {
        const reader = req.body?.getReader();
        if (!reader) return json({ error: "expected JSON body { slug, saved }" }, 400);
        const chunks: Uint8Array[] = []; let size = 0;
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 2048) { await reader.cancel(); return json({ error: "request too large" }, 413); }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size); let pos = 0;
        for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length; }
        body = JSON.parse(new TextDecoder().decode(bytes));
      } catch { return json({ error: "expected JSON body { slug, saved }" }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "expected JSON body { slug, saved }" }, 400);
      const { slug, saved } = body as Record<string, unknown>;
      if (typeof slug !== "string" || slug.length > 100 || !d.knownSlug(slug)) return json({ error: "unknown pack slug" }, 404);
      if (typeof saved !== "boolean") return json({ error: "expected boolean 'saved'" }, 400);
      try { return json({ slugs: await d.setInLibrary(id, slug, saved), saved }); }
      catch { d.reportFailure("write"); return json({ error: "library unavailable" }, 503); }
    },
  };
}
