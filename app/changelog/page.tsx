import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { getChangelog, fmtDate } from "@/lib/packs";

export default function ChangelogPage() {
  const entries = getChangelog();
  return (
    <>
      <Nav active="changelog" />
      <main>
        <div className="crumb">
          <b>Changelog</b>
        </div>
        <section className="phead">
          <span className="ptape"></span>
          <h1>Changelog</h1>
          <div className="ver">{entries.length} releases across the registry · newest first</div>
          <p className="task">
            Every tagged version of every pack, in one place. A pack version only ships when its
            note says what changed - no silent updates.
          </p>
        </section>
        <div className="card" style={{ marginTop: 24 }}>
          <span className="ptape"></span>
          {entries.map((e) => (
            <div className="clog-entry" key={`${e.slug}-${e.version}`}>
              <span className="d">{fmtDate(e.date)}</span>
              <span className="v">v{e.version}</span>
              <Link className="p" href={`/packs/${e.slug}`} style={{ color: "#b4432f", textDecoration: "none" }}>
                {e.packName}
              </Link>
              <span className="n">{e.note}</span>
            </div>
          ))}
        </div>
      </main>
      <Footer label="Changelog" />
    </>
  );
}
