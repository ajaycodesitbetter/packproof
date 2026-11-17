import Link from "next/link";
import SearchBox from "./SearchBox";
import AuthButton from "./AuthButton";

export default function Nav({ active }: { active?: string }) {
  return (
    <>
      <nav className="nav">
        <Link className="wordmark" href="/">
          <span className="stamp">P</span>PackProof
        </Link>
        <div className="nav-links">
          <Link className={active === "packs" ? "active" : ""} href="/packs">Packs</Link>
          <Link className={active === "method" ? "active" : ""} href="/method">Methodology</Link>
          <Link className={active === "changelog" ? "active" : ""} href="/changelog">Changelog</Link>
          <Link className={active === "categories" ? "active" : ""} href="/packs#categories">Categories</Link>
          <Link className={active === "discover" ? "active" : ""} href="/discover">Discover</Link>
        </div>
        <div className="nav-right">
          <SearchBox />
          <AuthButton />
        </div>
      </nav>
      <div className="demo-banner" role="note">
        <span className="db-stamp">Concept demo</span>
        <span>
          The pack files are real and downloadable. All versions, counts and evidence numbers are
          staged sample data - no live benchmark runs yet.
        </span>
      </div>
    </>
  );
}
