export default function Footer({ label }: { label?: string }) {
  return (
    <div className="footnote">
      <span>
        Concept stage - counts, versions and statuses marked as sample data are staged examples, not live benchmark results.
      </span>
      <span>{label ?? "PackProof"} · Ajay Mathuriya · @codesitbetter</span>
    </div>
  );
}
