import Link from "next/link";
import SearchBox from "./SearchBox";
import AuthButton from "./AuthButton";

export default function Nav({ active, searchQuery = "" }: { active?: string; searchQuery?: string }) {
  return (
    <>
      <nav className="nav">
        <Link className="wordmark" href="/">
          <span className="stamp">P</span>PackProof
        </Link>
        <div className="nav-links">
          <Link className={active === "skills" ? "active" : ""} href="/skills">Skills</Link>
          <Link className={active === "packs" ? "active" : ""} href="/packs">Packs</Link>
          <Link className={active === "discover" ? "active" : ""} href="/discover">Discover <span className="nav-tag">unvetted</span></Link>
        </div>
        <div className="nav-right">
          <SearchBox defaultQuery={searchQuery} />
          <AuthButton />
        </div>
      </nav>
      <div className="demo-banner" role="note">
        <span className="db-stamp">Concept demo</span>
        <span>
          PackProof packs are downloadable. Registry benchmark reports are staged samples, not validated results.
          Upstream picks are source-linked, not run-tested.
        </span>
      </div>
    </>
  );
}
