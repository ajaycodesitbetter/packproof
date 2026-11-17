export default function Footer({ label }: { label?: string }) {
  return (
    <div className="footnote">
      <span>
        Concept stage - counts, versions and statuses marked as sample data are staged examples, not live benchmark results.
      </span>
      <span>
        {label ?? "PackProof"} ·{" "}
        <a href="https://ajaymathuriya.com" target="_blank" rel="noopener noreferrer">
          Ajay Mathuriya
        </a>{" "}
        ·{" "}
        <a href="https://x.com/codesitbetter" target="_blank" rel="noopener noreferrer">
          @codesitbetter
        </a>
      </span>
    </div>
  );
}
