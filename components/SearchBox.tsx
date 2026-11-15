"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./Icons";

// Global nav search: searches live GitHub skill repos via /discover (the
// user's actual ask), not just the sample registry. The registry has its
// own filter form on /packs, labeled as such.
export default function SearchBox() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") inputRef.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form className="searchbox" action="/discover" method="get">
      <div className="search">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          name="q"
          placeholder="Search GitHub skill repos"
          aria-label="Search GitHub skill repos"
        />
        <kbd>/</kbd>
      </div>
    </form>
  );
}
