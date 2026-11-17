import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// Instant feedback while the registry is filtered/searched server-side, so
// slow connections never look frozen between the click and the result.
export default function PacksLoading() {
  return (
    <>
      <Nav active="packs" />
      <main>
        <section className="loading-panel" aria-busy="true">
          <span className="ptape"></span>
          <span className="lp-stamp">Loading</span>
          <h1>The registry</h1>
          <p>
            Filtering the pack registry
            <span className="loading-dots" aria-hidden="true" />
          </p>
        </section>
      </main>
      <Footer label="Packs" />
    </>
  );
}
