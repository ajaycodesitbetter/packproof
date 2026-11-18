# PackProof

Task-first discovery for agent workflows, with source links, setup guidance and explicit evidence limits. The interface keeps a paper-and-ink scrapbook style.

## What works

- 12 downloadable PackProof SKILL.md workflow documents.
- `/skills`: a local-search field guide with agent, task and source filters; an editorial shortlist links to original upstream projects instead of mirroring their code.
- `/discover`: live public GitHub repo search and discovery shelves. GitHub popularity is not a quality or safety score.
- GitHub sign-in and a per-user saved-pack library, backed by Turso/libSQL in the current Vercel deployment.
- Version-checked pack downloads. Existing unversioned download URLs remain supported. A requested version that is not available returns 409 rather than silently substituting a newer one.

## Evidence limits

All legacy registry versions, dates, scores and benchmark reports are staged sample data. No pack is represented as benchmark-validated. Upstream source checks are not execution tests or security certification. Agent install locations are grounded in the vendors' documentation, but runtime compatibility has not been established across Claude Code, Codex and Antigravity.

The exploratory `benchmarks/pr-review-pilot` is separate from the sample reports. A one-repetition, one-model, prompt-level comparison cannot establish general effectiveness or installed-agent compatibility. Do not turn pilot data into a validated badge.

## Stack and development

Next.js 15 App Router, React, TypeScript and handwritten CSS. No UI framework. Auth.js provides identity-only GitHub sign-in. Production uses the libSQL store; legacy D1/Netlify adapters remain in source but are not the current deployment route.

```sh
npm ci
npm run dev
npm run build
npm start
```

See `DEPLOYMENT.md` for runtime requirements. Never commit environment files or credentials.

## Acceptance checks

```sh
npx tsx test/discovery.test.mts
npx tsx test/coord-libsql.test.mts
npx tsx test/return-path.test.mts
node test/search-route.test.cjs
npx tsx test/library-http.test.mts
node test/recovery.test.mjs
# After npm run build, offline local server/session test:
node scripts/session-check.mjs
# Against a running local production server on port 3100:
CHECK_VERSION_GUARD=1 node scripts/smoke.mjs http://localhost:3100
CHROME_PATH=/usr/bin/google-chrome node scripts/browser-check.cjs http://localhost:3100
npm audit --omit=dev
```

The browser suite uses the Playwright dev dependency and an existing Chrome executable. Set `CHROME_PATH` to its installed location. It does not download a browser. HTTP checks are read-only and do not sign in or change library data. The version-guard flag is for the prepared release; omit it when checking an older deployment.

## Routes

`/` home; `/skills` task and agent field guide; `/packs` PackProof registry; `/packs/[slug]` pack details; `/reports/[slug]` sample reports; `/discover` live GitHub discovery; `/library` saved packs; `/signin` explanation before GitHub OAuth; `/method` evidence protocol; `/changelog` sample version history.

JSON APIs: `/api/packs`, `/api/packs/[slug]`, `/api/packs/[slug]/download`, `/api/categories`, `/api/search`, `/api/discover`, `/api/library`. Library access requires a valid authenticated session. Authenticated writes use desired state `{slug, saved}` rather than a toggle.

## Safe use and licensing

Skills can influence an agent that has file, network or command access. Read the complete skill bundle and keep normal permission prompts enabled. A shared SKILL.md format does not make scripts, tools or dependencies portable or safe.

External entries link to their source; no third-party instructions or assets are redistributed by the catalog. License notes are entry-specific. Some upstream product dependencies have their own terms or costs. The legacy PackProof license fields are part of sample registry metadata; a repository-wide license and release policy still require an explicit owner decision before those labels can be treated as a legal grant.

Local authorization, bounded burst and recovery drill details are in `docs/operations.md`. They do not replace real OAuth/live acceptance or an owner-approved production backup policy.
