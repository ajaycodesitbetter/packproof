"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function SaveButton({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) {
      setSaved(null);
      return;
    }
    fetch("/api/library")
      .then((r) => (r.ok ? r.json() : { slugs: [] }))
      .then((d) => setSaved(d.slugs.includes(slug)))
      .catch(() => setSaved(null));
  }, [session, slug]);

  const toggle = async () => {
    if (!session) return signIn("github");
    setBusy(true);
    try {
      const r = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, saved: saved !== true ? true : false }),
      });
      if (r.ok) {
        const d = await r.json();
        setSaved(d.saved);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="savebtn" onClick={toggle} disabled={busy}>
      {saved ? "★ in your library" : "☆ save to library"}
    </button>
  );
}
