import Link from "next/link";
import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PackCard from "@/components/PackCard";
import { getAllPacks, getCategories, normalizeCategory, searchPacks, fmtDate } from "@/lib/packs";

export const metadata: Metadata = {
  title: "The registry - PackProof",
  description:
    "Every pack is a small workflow file for your coding agent, with pinned versions and published evidence. Concept stage: sample evidence.",
};

export default async function PacksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const catParam = sp.category ?? "";
  const cat = catParam ? normalizeCategory(catParam) : undefined;

  let packs = getAllPacks();
  if (cat) packs = packs.filter((p) => p.category === cat);
  if (q) {
    const hits = new Set(searchPacks(q).map((p) => p.slug));
    packs = packs.filter((p) => hits.has(p.slug));
  }

  const cats = getCategories();
  const total = cats.reduce((n, c) => n + c.count, 0);
  // Newest pack release in the registry data, not a hand-typed date that
  // silently goes stale.
  const lastUpdated = fmtDate(getAllPacks().map((p) => p.released).sort().at(-1)!);

  return (
    <>
      <Nav active="packs" />
      <main>
        <div className="crumb">
          <b>All packs</b>
          {cat ? ` / ${cat}` : ""}
          {q ? ` / search: "${q}"` : ""}
        </div>
        <section className="phead">
          <span className="ptape"></span>
          <h1>The registry</h1>
          <div className="ver">
            {packs.length} of {total} packs · {q || cat ? "filtered" : "unfiltered"} · updated {lastUpdated}
          </div>
          <p className="task">
            Every pack is a small workflow file for your coding agent. Statuses: sample report means the
            demo evidence format is filled in; in testing means nothing is claimed yet.
          </p>
        </section>
        <div className="toolbar">
          <form action="/packs" method="get">
            {cat && <input type="hidden" name="category" value={cat} />}
            <input type="search" name="q" placeholder="Filter the registry, e.g. migration" defaultValue={q} aria-label="Filter the registry" />
            <button type="submit">Search</button>
          </form>
        </div>
        <div className="catrow" id="categories">
          <span className="catlbl">Category</span>
          <Link className={`chip${!cat ? " on" : ""}`} href={q ? `/packs?q=${encodeURIComponent(q)}` : "/packs"}>
            All <i>{total}</i>
          </Link>
          {cats.map((c) => (
            <Link
              key={c.name}
              className={`chip${cat === c.name ? " on" : ""}`}
              href={`/packs?category=${encodeURIComponent(c.name)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            >
              {c.name} <i>{c.count}</i>
            </Link>
          ))}
        </div>
        <section className="packs">
          {packs.map((p) => (
            <PackCard key={p.slug} pack={p} />
          ))}
        </section>
        {packs.length === 0 && (
          <p className="empty-note">
            No packs match{q ? ` "${q}"` : ""}{cat ? ` in ${cat}` : ""}. Try a broader term, or browse
            all packs.
          </p>
        )}
      </main>
      <Footer label="Packs" />
    </>
  );
}
