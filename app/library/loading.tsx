import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// Instant feedback while the signed-in library is read from the database.
export default function LibraryLoading() {
  return (
    <>
      <Nav active="library" />
      <main>
        <section className="loading-panel" aria-busy="true">
          <span className="ptape"></span>
          <span className="lp-stamp">Loading</span>
          <h1>My packs</h1>
          <p>
            Reading your saved packs
            <span className="loading-dots" aria-hidden="true" />
          </p>
        </section>
      </main>
      <Footer label="My packs" />
    </>
  );
}
