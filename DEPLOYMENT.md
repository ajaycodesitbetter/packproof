# PackProof deployment readiness (Vercel + Turso Free path)

Status: source is ready for a standard Next.js deploy. No production deploy
has been run from this branch. The steps below are the exact remaining
execution decisions and actions, in order.

## 1. Get this branch onto GitHub (user action)

The public repo's `main` is preserved untouched in history. Push the
`reconcile-v3` branch from a real git client (local clone of the delivered
bundle, or a scoped personal access token). Do NOT use the GitHub web upload
(it caused the numeric-prefix file defect) or github.dev (OAuth flow failed
in the cloud browser). No force-push is needed: `reconcile-v3` builds on top
of the current remote `main`.

## 2. Accounts the user must create/own (not creatable by an agent)

- **Vercel** (Hobby, $0): import the GitHub repo. Hobby is free with no
  per-request CPU-ms cap (the Cloudflare Free blocker does not exist here).
  DECISION STILL OPEN: Hobby terms' commercial-use suitability if PackProof
  ever launches commercially - revisit at launch intent, not now.
- **Turso** (Free, $0, no card): one database. Free allowance (verified
  against turso.tech/pricing + docs, Nov 2026): 100 databases, 5GB storage,
  500M rows read/month, 10M rows written/month. Hard-stop behavior: past any
  single limit, queries fail with a BLOCKED error until upgrade - the free
  plan can never bill automatically (overages exist only on paid plans and
  are disabled by default). This workload (single-row saves/unsaves) is
  trivially inside the allowance.

## 3. Apply the schema (one command after the Turso database exists)

The same migrations used for D1 apply unchanged:

    turso db shell <database-name> < migrations/0001_library.sql
    turso db shell <database-name> < migrations/0002_discovery_cache.sql

The second table lets the /discover page's GitHub snapshot survive serverless
cold starts (last-good cache across instances). Optional: PACKPROOF_GITHUB_TOKEN
raises the GitHub search allowance for /discover from 10 to 30 req/min -
read-only public search only, off by default, attach only with the user's
approval.

## 4. Environment variables for the Vercel project

- `PACKPROOF_STORE=libsql` - selects the Turso backend
- `TURSO_DATABASE_URL` - from Turso (libsql://...)
- `TURSO_AUTH_TOKEN` - from Turso
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` - GitHub OAuth app credentials
- `AUTH_SECRET` - NextAuth session secret (openssl rand -base64 32)

The GitHub OAuth app's callback URL must be updated to the Vercel domain
(https://<site>/api/auth/callback/github) or sign-in will fail. The existing
OAuth app can be edited; no new grant types are needed (identity-only
scopes: read:user, user:email).

## 5. What is already verified (do not re-litigate)

- tsc clean; next build clean; all 12 pack pages and 7 API routes build.
- Library store correctness, proven locally on BOTH the D1 path (wrangler
  dev --local) and the new libSQL path (@libsql/client 0.18.0 against a
  local file database): identity isolation, independent same-slug saves,
  unsave isolation, 5 concurrent duplicate saves -> 1 row, 10 parallel
  distinct saves -> 10 rows, injection-shaped user id -> empty result.
- Session identity boundary: /api/library takes identity ONLY from the
  NextAuth JWT session (token.sub -> session.user.id); the request body is
  used for {slug, saved} only, and slug is validated against the registry.
  401 when signed out. A live second-GitHub-account OAuth test is still
  undone - it needs a real second identity at deploy time, not before.

## 6. What must NOT be claimed

- Benchmark numbers in the registry are staged sample data (labeled
  sample_data in the API and on pages). Of 12 published packs, evidence is
  complete for 1, partial for 1, in testing for 10. Do not present the packs
  as benchmark-validated until real evidence runs exist.

## 7. Other backends remain intact

- D1 (Cloudflare Workers): code and config preserved; runtime ruled out on
  Workers Free (measured 25.65ms median CPU vs 10ms cap). D1 database and
  its 1 test row are untouched.
- Netlify Blobs: code preserved; Netlify deploy resumes after its quota
  resets Nov 21, but its GitHub-linked runtime historically hung Blobs
  calls. Fallback only.
- Local file store: dev-only, production-gated.
