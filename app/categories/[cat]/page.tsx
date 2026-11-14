import Link from "next/link";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PackCard from "@/components/PackCard";
import { getByCategory, getCategories, normalizeCategory } from "@/lib/packs";

export function generateStaticParams() {
  return getCategories().map((c) => ({ cat: c.name }));
}

export default function CategoryPage({ params }: { params: { cat: string } }) {
  const decoded = decodeURIComponent(params.cat);
  const cat = normalizeCategory(decoded);
  if (!cat) notFound();
  const packs = getByCategory(cat);
  const published = packs.filter((p) => p.published).length;

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
            {packs.length} packs · {published} published · {packs.length - published} in testing
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
