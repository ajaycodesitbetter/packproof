# Operations and local security gates

17 November 2026. Private candidate, no live deployment or production data access in these drills.

## Checked boundaries

`lib/library-http.ts` owns the custom library API's request boundary. Identity comes only from Auth.js through the route wrapper. The request body cannot choose a user. Writes require same-origin Origin, JSON content type, an allowed slug and boolean desired state. Cross-site fetch metadata is rejected. The body is streamed with a2KB maximum, so a missing or understated content length does not bypass the cap. Reads and writes return private/no-store responses. Store failures return503 and a generic JSON message, with only a fixed operation label in the server event log. No user ID, raw database error, token or request body is logged by this event.

The library store's timeout timers are cleared after completion. A timeout rejects the application wait; it does not prove the remote provider canceled the underlying operation. Writes remain idempotent by desired state, which is important when retrying an ambiguous result.

`test/library-http.test.mts`:34 checks using a real local libSQL file and synthetic identities. Includes signed-out denial, origin/content/body checks, body identity spoofing, same-slug isolation, SQL-shaped IDs,50 concurrent duplicate writes,100 local reads and redacted failures.

`scripts/session-check.mjs`:14 checks against the built local Next server using short-lived locally signed Auth.js session tokens and an ephemeral secret. No test-auth endpoint is added. Includes forged and expired cookie rejection, actual request-to-session identity mapping, two users' save/unsave isolation, body identity spoofing and cross-origin write rejection. A100-request anonymous local burst returns401. This does not establish GitHub OAuth callback behavior, real provider account isolation or live deployment configuration.

These bounded local bursts are regression checks, not a load-capacity or denial-of-service certification. There is no distributed per-user library rate limiter in this candidate. A valid user can make repeated reads/writes, although saved rows are limited to registry slugs and writes are idempotent. Provider quotas, error rates and abuse monitoring remain operating concerns. Do not claim an unmeasured requests-per-second capacity.

## Backup and recovery drill

`scripts/library-recovery.mjs` is local-only. It accepts local filesystem paths, never a Turso URL. It snapshots only the durable `library_saves` rows in a read transaction into a new mode0600 file, with format/version and SHA256 integrity envelope. Restore refuses an existing destination, validates the envelope and writes a new SQLite/libSQL database. It preserves both users' rows and timestamps. A hash catches accidental damage, not malicious editing by someone who can replace the file and hash.

`test/recovery.test.mjs`:9 checks. Two synthetic identities restored exactly; normal new writes work after restore; restrictive snapshot permissions checked; source/snapshot overwrite refused; a corrupted snapshot rejected before creating a database. The initial scratch drill caught a schema-column mismatch and was fixed against the actual migration before these tests passed. No real user snapshot was made and no remote restore was attempted.

Production backups must not be put into a source-code archive or a broadly shared folder. They contain user identifiers and saved-pack choices. The local drill proves format recovery, not a complete provider disaster-recovery process.

## Proposed operating policy, not activated

- Owner-selected recovery objectives, for example daily durable-library snapshots with a24-hour recovery-point target and a tested manual recovery procedure. A target is not an existing guarantee.
- Store encrypted or access-controlled backups privately, separate from deployment credentials. Record snapshot time, source schema/revision and integrity hash. Never log row contents.
- Suggested retention for owner review:7 daily and4 weekly snapshots; prove a replacement snapshot before deleting an older one. No deletion schedule is configured or authorized.
- Restore drills use a new isolated database first. Compare row counts and representative synthetic records, test new writes, and only then plan a production cutover/rollback with owner approval. Do not overwrite the live database as a test.
- Monitor fixed `library_store_unavailable` events, HTTP503 rate, sign-in failures, provider usage and discovery-rate-limit events. Decide an owner-visible alert destination and retention period before claiming active monitoring. No new logging vendor, account permission or paid service is needed for the current console event.
- Discovery caches and coordination leases are derived data; library rows are the durable user data. A full provider backup policy may include the other tables for convenience, but cache regeneration must not be confused with lost user data.

## Remaining owner/external gates

Choose the release route and publication authority separately. After publishing the selected revision, perform live read-only acceptance and an approved two-real-identity OAuth/library test. Choose backup destination, retention, recovery objectives, error-alert audience and maintenance ownership before enabling scheduled production operations. Verify the actual provider plan/spending state and current commercial-use terms if launching commercially. No new grant, signup, paid tool, live stress test or destructive production operation was performed for this work.
