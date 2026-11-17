"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";

export default function SaveButton({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setSaved(null);
      setError(null);
      return;
    }
    fetch("/api/library")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("library read failed"))))
      .then((d) => {
        setSaved(d.slugs.includes(slug));
        setError(null);
      })
      .catch(() => {
        setSaved(null);
        setError("library unavailable");
      });
  }, [session, slug]);

  const toggle = async () => {
    if (!session) return signIn();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, saved: saved !== true ? true : false }),
      });
      if (r.ok) {
        const d = await r.json();
        setSaved(d.saved);
      } else {
        setError("couldn't save - try again");
      }
    } catch {
      setError("couldn't save - try again");
    } finally {
      setBusy(false);
    }
  };

  const unavailable = session && saved === null && error === "library unavailable";

  return (
    <button
      className="savebtn"
      onClick={toggle}
      disabled={busy || !!unavailable}
      title={error ?? undefined}
    >
      {unavailable
        ? "library unavailable"
        : error
          ? error
          : saved
            ? "★ in your library"
            : "☆ save to library"}
    </button>
  );
}
