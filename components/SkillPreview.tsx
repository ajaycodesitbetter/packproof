import { SKILL_FILES } from "@/lib/skill-files";

// Shows the actual SKILL.md a pack ships - no blind curl. Excerpt of the
// first lines plus a download route for the full file.
export default function SkillPreview({ slug }: { slug: string }) {
  const file = SKILL_FILES[slug];
  if (!file) return null;
  const lines = file.content.split("\n");
  const excerpt = lines.slice(0, 30).join("\n");
  return (
    <section className="skill-preview" aria-label="What is inside the pack">
      <h2>What&apos;s inside</h2>
      <p className="skill-preview-note">
        The first {Math.min(30, lines.length)} of {lines.length} lines of the actual {file.filename} you would
        install. Read it before it touches your project.
      </p>
      <pre className="skill-preview-pre"><code>{excerpt}</code></pre>
      <a className="skill-source-link" href={`/api/packs/${slug}/download`}>
        Download the full file <span aria-hidden="true">↓</span>
      </a>
    </section>
  );
}
