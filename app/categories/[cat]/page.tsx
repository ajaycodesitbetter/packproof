import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PackCard from "@/components/PackCard";
import { getByCategory, getCategories, normalizeCategory } from "@/lib/packs";

export function generateStaticParams() {
  return getCategories().map((c) => ({ cat: c.name }));
}

export async function generateMetadata({ params }: { params: Promise<{ cat: string }> }) {
  const { cat: rawCat } = await params;
  const cat = normalizeCategory(decodeURIComponent(rawCat));
  if (!cat) return {};
  return {
    title: `${cat} packs - PackProof`,
    description: `Workflow packs in the ${cat} category. Concept stage: sample evidence.`,
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat: rawCat } = await params;
  const decoded = decodeURIComponent(rawCat);
  const cat = normalizeCategory(decoded);
  if (!cat) notFound();
  const packs = getByCategory(cat);
  // Count the same sample-scoped status the card badges show (Sample report /
  // Sample partial / In testing), so the header and the cards tell one story
  // and staged evidence is never implied to be a completed real benchmark.
  const complete = packs.filter((p) => p.status === "evidence-complete").length;
  const partial = packs.filter((p) => p.status === "partial").length;

  return (
    <>
      <Nav active="categories" />
      <main>
        <div className="crumb">
          <Link href="/packs">Packs</Link> / Categories / <b>{cat}</b>
        </div>
        <section className="phead">
          <span className="ptape"></span>
          <h1>{cat}</h1>
          <div className="ver">
            {packs.length} packs · {complete} sample report{complete === 1 ? "" : "s"}
            {partial > 0 ? ` · ${partial} sample partial` : ""} · {packs.length - complete - partial} in testing
          </div>
          <p className="task">
            {cat === "Backend" &&
              "Packs for the server side: endpoints, migrations, tests, configuration."}
            {cat === "Research" &&
              "Packs that turn loose questions into sourced, confidence-tagged answers."}
            {cat === "UI/UX" &&
              "Packs that review interfaces: states, consistency, accessibility, copy."}
          </p>
        </section>
        <section className="packs">
          {packs.map((p) => (
            <PackCard key={p.slug} pack={p} />
          ))}
        </section>
      </main>
      <Footer label={`Category - ${cat}`} />
    </>
  );
}
