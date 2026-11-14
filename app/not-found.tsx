import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main>
        <section className="phead" style={{ marginTop: 60 }}>
          <span className="ptape"></span>
          <h1>Page not found</h1>
          <p className="task">
            This page isn&apos;t in the registry. Try <Link href="/packs" style={{ color: "#b4432f" }}>all packs</Link> or
            search from the box above.
          </p>
        </section>
      </main>
      <Footer label="404" />
    </>
  );
}
