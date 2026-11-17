import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import SignInContinue from "@/components/SignInContinue";

export const metadata: Metadata = {
  title: "Sign in - PackProof",
  description: "Sign in with GitHub to save packs. Identity only - no repo or write access.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  // Only same-site paths are honoured as callbacks; anything else falls back
  // to the library page.
  const callbackUrl =
    sp.callbackUrl && sp.callbackUrl.startsWith("/") ? sp.callbackUrl : "/library";
  if (session) redirect(callbackUrl);

  return (
    <>
      <Nav />
      <main>
        <section className="phead">
          <span className="ptape"></span>
          <h1>Sign in</h1>
          <div className="ver">one click away - here is exactly what happens next</div>
          <p className="task">
            PackProof uses GitHub sign-in for one thing: pinning your saved packs to you. It
            requests <b>identity only</b> - no repository access, no write access, nothing
            else. The next step takes you to github.com to approve that, then brings you
            straight back.
          </p>
          <div className="cta-row" style={{ marginTop: 18 }}>
            <SignInContinue callbackUrl={callbackUrl} />
            <Link className="btn b2" href="/packs">
              Keep browsing
            </Link>
          </div>
        </section>
      </main>
      <Footer label="Sign in" />
    </>
  );
}
