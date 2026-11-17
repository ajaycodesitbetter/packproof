# PackProof

Skill packs with published proof. Small workflow packs for coding agents - every
release ships pinned versions, before-and-after runs, and the failures.

**Concept stage:** the registry's versions, counts and evidence numbers are
staged sample data (labeled on every page). The pack files themselves are real
and usable; live benchmark runs are the next milestone.

## Stack

- Next.js 15 (App Router, TypeScript), hand-written CSS, no UI framework
- Backend: Next.js API routes serving the registry, search, categories,
  pack-file downloads and the per-user library
- Data: typed seed registry in `lib/packs-data.ts`, pack artifacts in
  `lib/skill-files.ts`
- Auth: GitHub OAuth via Auth.js (`auth.ts`)
- Per-user library: one row per (user, pack) save - atomic, idempotent writes
  with no read-modify-write race. Storage backends selectable per deployment:
  - Cloudflare D1 (`PACKPROOF_STORE=d1`, migration in `migrations/0001_library.sql`)
  - Netlify Blobs (default on Netlify)
  - Local JSON file (dev only)

## Develop

```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
```

## Test

```bash
# Local isolation/race tests for the D1 library path with synthetic identities
npx wrangler d1 execute packproof-library-test --local --config wrangler.test.jsonc --file migrations/0001_library.sql
npx wrangler dev --local --config wrangler.test.jsonc --define "process.env.NODE_ENV:\"production\""
# then drive http://localhost:8787/save?user=X&slug=Y and /get?user=X
```

## API

| Route | What it does |
| --- | --- |
| `GET /api/packs` | List packs; `?category=Backend` and `?q=term` filters |
| `GET /api/packs/[slug]` | One pack, full evidence detail |
| `GET /api/categories` | Categories with computed counts |
| `GET /api/search?q=...` | Ranked search across name, slug, category, text |
| `GET /api/packs/[slug]/download` | Download the pack's SKILL.md (409 while unpublished) |
| `GET /api/library` | Signed-in user's saved packs (401 signed out) |
| `POST /api/library` | Desired-state save/unsave: `{ slug, saved }` (401 signed out) |

## Pages

`/` home · `/packs` registry (filter + search) · `/packs/[slug]` detail ·
`/reports/[slug]` release report · `/categories/[cat]` · `/changelog` ·
`/method` · `/library` · `/discover` live GitHub discovery (fresh skill repos +
star-ranked category shelves, 6h cache)

## Deploy

Two supported targets, same codebase:

- **Cloudflare Workers**: `wrangler.jsonc` + `open-next.config.ts`
  (@opennextjs/cloudflare), library in D1
- **Netlify**: `netlify.toml`, library in Netlify Blobs

---

Ajay Mathuriya · @codesitbetter
