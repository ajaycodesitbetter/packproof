"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icons";

// Global nav search: searches live GitHub skill repos via /discover (the
// user's actual ask), not just the sample registry. The registry has its
// own filter form on /packs, labeled as such. The pending feedback on
// submit (kbd swaps to "Searching", input turns readOnly, restored on
// bfcache) is handled by the delegated script in app/layout.tsx.
export default function SearchBox({ defaultQuery = "" }: { defaultQuery?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/") {
        // Don't steal the keystroke from someone typing in any field.
        const el = document.activeElement;
        const typing =
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement ||
          el instanceof HTMLSelectElement ||
          (el instanceof HTMLElement && el.isContentEditable);
        if (typing) return;
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form className="searchbox" action="/discover" method="get" aria-busy="false">
      <div className="search">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={defaultQuery}
          enterKeyHint="search"
          placeholder="Search skill repos"
          aria-label="Search GitHub skill repos"
        />
        <button className="nav-search-submit" type="submit" aria-label="Search GitHub skill repos" title="Search (Enter)">Go</button>
        <span className="search-pending" role="status" hidden>
          Searching<span className="loading-dots" aria-hidden="true" />
        </span>
      </div>
      <span className="search-hint" aria-hidden="true">Press / to focus · Enter to search</span>
    </form>
  );
}
