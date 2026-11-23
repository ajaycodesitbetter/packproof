import Link from "next/link";

export default function Footer({ label }: { label?: string }) {
  return (
    <div className="footnote">
      <span>
        Concept stage - counts, versions and statuses marked as sample data are staged examples, not live benchmark results.
      </span>
      <span className="foot-links">
        <Link href="/method">Methodology</Link>
        <Link href="/changelog">Changelog</Link>
        <Link href="/packs#categories">Categories</Link>
      </span>
      <span>{label ?? "PackProof"} · Ajay Mathuriya · @codesitbetter</span>
    </div>
  );
}
