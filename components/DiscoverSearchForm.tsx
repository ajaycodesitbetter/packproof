// The discover search is a plain GET form (URL stays shareable, works
// without JS) that can take a couple of seconds against the live GitHub
// API. The pending feedback while the browser loads the next document is
// handled by the small delegated script in the root layout (see
// app/layout.tsx) - it flips aria-busy, disables the button and swaps the
// label spans, and resets on bfcache restore. This component itself is
// static markup; the native submission is never intercepted.
export default function DiscoverSearchForm({ defaultQuery }: { defaultQuery: string }) {
  return (
    <form action="/discover" method="get" aria-busy="false">
      <input
        type="search"
        name="q"
        placeholder="Search GitHub, e.g. design review"
        defaultValue={defaultQuery}
        aria-label="Search GitHub"
      />
      <button type="submit">
        <span className="btn-label">Search</span>
        <span className="btn-label-pending" hidden>
          Searching
          <span className="loading-dots" aria-hidden="true" />
          <span className="sr-only">Searching GitHub, please wait</span>
        </span>
      </button>
    </form>
  );
}
