"use client";

import Link from "next/link";
import { useEffect } from "react";

// Last-resort boundary for unexpected render errors (e.g. an upstream API
// returning a shape the page did not expect). Keeps the scrapbook shell and
// offers a retry instead of a bare white error.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("page render failed:", error);
  }, [error]);

  return (
    <main>
      <section className="loading-panel" style={{ marginTop: 60 }}>
        <span className="ptape"></span>
        <span className="lp-stamp">Something broke</span>
        <h1>This page hit an error</h1>
        <p>
          The page failed to render. Trying again usually fixes a transient fetch problem; if it
          keeps happening, the rest of the site still works.
        </p>
        <p style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <button className="btn b1" style={{ border: "none", cursor: "pointer" }} onClick={reset}>
            Try again
          </button>
          <Link className="btn b2" href="/">
            Back to home
          </Link>
        </p>
      </section>
    </main>
  );
}
