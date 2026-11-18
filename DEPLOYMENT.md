# Deployment and release checks

Updated 17 November 2026. This document describes the prepared source and release process, not approval to publish it.

## Current route

The current application runs on Vercel with a Turso/libSQL store. The canonical owner domain is https://packproof.ajaymathuriya.com/. The alias https://packproof-three.vercel.app/ serves the same deployment. The deleted Netlify copy must not be recreated.

The readiness changes prepared locally have not been pushed or deployed. The owner must first choose the GitHub-to-Vercel deployment route: retain automatic deployments or use a manual route. Do not push while that decision is open, because a push may publish the work. Do not change that account setting without approval.

## Runtime configuration

Required for the current Node/serverless route:

- `PACKPROOF_STORE=libsql`
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` and `AUTH_SECRET`

Keep values in the hosting provider's secret environment settings. Do not place credentials in screenshots, logs, source archives or `.env` files committed to Git.

The GitHub OAuth app uses identity-only access, not repository-write access. Its callback must match the chosen site at `/api/auth/callback/github`. Changes to that app or its permissions require owner approval. Do not widen access to make a release easier.

`PACKPROOF_GITHUB_TOKEN` is optional for public GitHub discovery. An additional credential or grant is not a release prerequisite; request approval before adding one. Discovery cache and concurrency settings are configurable through the `PACKPROOF_DISCOVERY_*` variables in `lib/discovery.ts`.

The current schema is in `migrations/0001_library.sql`, `migrations/0002_discovery_cache.sql`, and `migrations/0003_discovery_coord.sql`. For an existing database, inspect the schema and migration state before applying anything. Back up data and establish a recovery path before any destructive migration. This release does not require a new database or a destructive migration.

## Cost and terms

No paid plan, upgrade or new service has been approved. Provider limits and terms can change. Do not treat historical quota numbers in older notes or comments as the current contract.

Official pages checked 17 Nov 2026:

- https://vercel.com/docs/plans/hobby
- https://turso.tech/pricing

Vercel describes Hobby as a free tier with finite usage and pauses after limits. Commercial-use suitability must be checked against the current terms and the owner's intended use before a commercial launch. The fetched plan page did not itself settle that question. Turso's current pricing must be checked alongside the actual account plan and settings; a public pricing page does not prove the account's spending configuration. No promise of unlimited traffic or automatically free scaling is made here.

## Acceptance and release sequence

1. Run the commands in README using a local production build. Keep test output and screenshots.
2. Confirm the final source diff, canonical domain, intended deployment method and owner publication approval.
3. Preserve an owner-only source archive and exact patch without secrets or dependency directories.
4. Publish only through the chosen route. Record the revision and deploy URL. Do not recreate Netlify or alter unrelated accounts.
5. Re-run the read-only HTTP checks against the deployed revision. Verify unknown pack/report paths return HTTP 404, version mismatch returns 409, downloads identify the requested version, and signed-out library requests return 401.
6. Inspect actual mobile and desktop pixels, including the install command, field guide filters, expanded card details and sample-report labels.
7. Check GitHub sign-in and save/unsave under the owner's approved test scope. Verify a second real identity independently before claiming live cross-account isolation. Local SQL isolation tests are not that check.
8. Reconfirm deployment health and rollback target. A successful build is not production acceptance.

## Evidence and remaining limits

The prepared release passed a production build, 78 read-only HTTP checks, 84 browser assertions at 320/390/768/1440 widths, 38 discovery tests, 14 libSQL-store tests, 13 safe-return checks and the search-route contract. These are dated local results, not live release results. The production-only dependency scan reports zero advisories; the full development tree has 10 findings (8 high, 2 moderate) through the preserved Cloudflare/OpenNext adapter. The suggested automatic remediation changes the adapter major version, so this has not been applied without adapter compatibility testing. The current Vercel build does not invoke that adapter. Do not describe the entire dependency tree as security-clean. The browser suite uses an existing local Chrome executable.

The public registry's reports remain staged samples. The separate six-call exploratory pilot is not a replacement for real task repositories, repeated baselines, installed-agent trials, raw tool traces and independently reviewable scoring.

Production observability, an owner-selected backup/restore and retention policy, dependency maintenance cadence, upstream link freshness checks, abuse/load testing and real multi-identity release acceptance still need operating decisions or additional evidence. Nothing in this document implies those are already complete.

## Preserved alternatives

Legacy Cloudflare D1, Netlify Blobs and local-file adapters remain in source for historical compatibility. They are not validated fallback deployments for this release. The local-file adapter is for isolated development/testing, never a shared production data store. Switching runtimes is a separate compatibility and authorization task.
