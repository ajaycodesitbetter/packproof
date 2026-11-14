# PackProof

Skill packs with published proof. Small workflow packs for coding agents - every
release ships pinned versions, before-and-after runs, and the failures.

**Concept stage:** the registry's versions, counts and evidence numbers are
staged sample data (labeled on every page). The pack files themselves are real
and usable; live benchmark runs are the next milestone.

## Stack

- Next.js 14 (App Router, TypeScript), hand-written CSS, no UI framework
- Backend: Next.js API routes serving the registry, search, categories and
  pack-file downloads
- Data: typed seed registry in `lib/packs-data.ts`, pack artifacts in
  `lib/skill-files.ts`

## Develop

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
```

## API

| Route | What it does |
| --- | --- |
| `GET /api/packs` | List packs; `?category=Backend` and `?q=term` filters |
| `GET /api/packs/[slug]` | One pack, full evidence detail |
| `GET /api/categories` | Categories with computed counts |
| `GET /api/search?q=...` | Ranked search across name, slug, category, text |
| `GET /api/packs/[slug]/download` | Download the pack's SKILL.md (409 while unpublished) |

## Pages

`/` home · `/packs` registry (filter + search) · `/packs/[slug]` detail ·
`/reports/[slug]` release report · `/categories/[cat]` · `/changelog` · `/method`

## Deploy

Builds as a standard Next.js app; `netlify.toml` included for Netlify deploys.

---

Ajay Mathuriya · @codesitbetter
