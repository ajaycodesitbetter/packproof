import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

// Shown instantly by the App Router while the live GitHub data is fetched
// server-side, so the page never looks frozen on a slow refresh.
export default function DiscoverLoading() {
  return (
    <>
      <Nav active="discover" />
      <main>
        <section className="loading-panel" aria-busy="true">
          <span className="ptape"></span>
          <span className="lp-stamp">Live fetch</span>
          <h1>Discover on GitHub</h1>
          <p>
            Pulling fresh repos from the GitHub search API
            <span className="loading-dots" aria-hidden="true" /> First load after a few quiet hours
            can take a couple of seconds; the result is then cached for about 6 hours.
          </p>
        </section>
      </main>
      <Footer label="Discover" />
    </>
  );
}
