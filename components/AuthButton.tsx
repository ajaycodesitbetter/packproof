"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Link from "next/link";

export default function AuthButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <span className="btn-sign" style={{ opacity: 0.6 }}>…</span>;
  }
  if (!session) {
    return (
      <span className="auth-actions signed-out" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link className="btn-sign" href="/library" style={{ textDecoration: "none", background: "none", color: "var(--ink)", border: "1.5px solid rgba(43,36,28,.55)", boxShadow: "2px 2px 0 rgba(43,36,28,.2)" }}>
          My packs
        </Link>
        <button className="btn-sign" style={{ border: "none", cursor: "pointer" }} onClick={() => signIn()}>
          Sign in
        </button>
      </span>
    );
  }
  return (
    <span className="auth-actions" style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Link className="btn-sign" href="/library" style={{ textDecoration: "none" }}>
        My packs
      </Link>
      <button
        className="copybtn"
        style={{ borderColor: "rgba(43,36,28,.4)", color: "rgba(43,36,28,.7)" }}
        title={`Signed in as ${session.user?.name ?? session.user?.email ?? "you"}`}
        onClick={() => signOut()}
      >
        Sign out
      </button>
    </span>
  );
}
