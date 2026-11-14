"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icons";

interface Hit {
  slug: string;
  name: string;
  category: string;
  status: string;
}

export default function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setHits(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setHits(data.results);
        setOpen(true);
      } catch {
        setHits([]);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="searchbox" ref={boxRef}>
      <div className="search">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search skills"
          value={q}
          aria-label="Search skills"
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) {
              setOpen(false);
              router.push(`/packs?q=${encodeURIComponent(q.trim())}`);
            }
          }}
        />
        <kbd>/</kbd>
      </div>
      {open && hits !== null && (
        <div className="search-results">
          {hits.length === 0 && <div className="sr-none">No packs match that search.</div>}
          {hits.map((h) => (
            <a key={h.slug} href={`/packs/${h.slug}`} onClick={() => setOpen(false)}>
              <span>{h.name}</span>
              <span className="sr-cat">{h.category}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
