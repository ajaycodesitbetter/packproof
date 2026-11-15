import Link from "next/link";
import { auth } from "@/auth";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import PackCard from "@/components/PackCard";
import { getLibrary } from "@/lib/library";
import { getPack } from "@/lib/packs";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth();
  let slugs: string[] | null = null;
  if (session?.user?.id) {
    try {
      slugs = await getLibrary(session.user.id);
    } catch {
      slugs = null;
    }
  }
  const loadFailed = !!session?.user?.id && slugs === null;
  const packs = (slugs ?? []).map((s) => getPack(s)).filter((p) => p !== undefined);

  return (
    <>
      <Nav active="library" />
      <main>
        <div className="crumb">
          <b>My packs</b>
        </div>
        <section className="phead">
          <span className="ptape"></span>
          <h1>My packs</h1>
          <div className="ver">
            {loadFailed
              ? `signed in as ${session?.user?.name ?? session?.user?.email}`
              : session
                ? `signed in as ${session.user?.name ?? session.user?.email} · ${packs.length} saved`
                : "your saved packs, pinned to your GitHub sign-in"}
          </div>
          <p className="task">
            {session
              ? "The packs you saved. Sign-in uses GitHub identity only - no repo or write access is requested."
              : "Sign in with GitHub (top right) to save packs here. Identity only - no repo or write access is requested."}
          </p>
        </section>
        {loadFailed && (
          <section className="lib-notice">
            <span className="ln-stamp">Temporarily unavailable</span>
            <p>
              The library isn&apos;t responding, so your saved packs can&apos;t be shown right now.
              Please try again later.
            </p>
            <p className="ln-links">
              <a href="/library">Try again</a>
              <Link href="/">Back to home</Link>
            </p>
          </section>
        )}
        {session && !loadFailed && packs.length > 0 && (
          <section className="packs">
            {packs.map((p) => (
              <PackCard key={p.slug} pack={p} />
            ))}
          </section>
        )}
        {session && !loadFailed && packs.length === 0 && (
          <p className="empty-note">
            Nothing saved yet. Open a pack from <Link href="/packs" style={{ color: "#b4432f" }}>the registry</Link> and
            hit &quot;save to library&quot;.
          </p>
        )}
      </main>
      <Footer label="My packs" />
    </>
  );
}
