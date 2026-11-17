// The actual pack artifacts served by /api/packs/[slug]/download.
// Only packs with published: true have a file here. These are real,
// usable skill documents - the sample-data label applies to the
// evidence numbers, not to the pack content.

const API_CHANGE_SAFETY_NET = `---
name: api-change-safety-net
description: Catch regressions when changing an existing API endpoint. Write a failing test that pins the current behaviour before making any change, so a broken contract shows up as a red test instead of a production incident. Use whenever editing, renaming, deprecating or extending an existing route, handler, or response shape.
---

# API Change Safety Net

## When to use

- Editing an existing endpoint's logic, validation, or error paths
- Renaming or removing response fields
- Adding query params, middleware, or auth to a live route
- Deprecating a route that still has callers

Do NOT use for greenfield endpoints - there is no old behaviour to pin.

## The rule

Before touching the implementation, prove the current behaviour with a
failing test. The order is fixed:

1. **Pin.** Write a test that asserts the endpoint's CURRENT behaviour:
   status code, response shape, headers that callers rely on, and the
   error bodies. Run it. It must pass against the unmodified code.
2. **Change the expectation, not the code.** Edit the test so it asserts
   the NEW intended behaviour. Run it. It must now FAIL. If it passes,
   your test was not pinning anything - fix the test first.
3. **Implement.** Make the smallest change that turns the new test green.
4. **Sweep.** Grep for other callers of the changed shape (frontend
   selectors, other services, docs snippets) and list them in the PR
   description, even when you did not update them all.

## What to pin, in priority order

1. Response field names and types actually read by callers
2. Status codes for the failure modes callers branch on
3. Header names - HTTP headers are case-insensitive on the wire but NOT
   in every client library; pin the exact casing the client reads
   (v0.3.1 exists because this was missed)
4. Ordering guarantees of list responses
5. Pagination defaults and cursor format

## Hard boundaries

- Do not write the fix before the failing test exists and has been seen red.
- Do not run the project's full suite; run only the pinning test file.
- Do not refactor neighbouring code while you are in the file.
- When deprecating a route: update the docs IN THE SAME CHANGE as the
  deprecation marker. A deprecated route with stale docs is the
  regression this pack is known for - check it explicitly.

## Reporting back

End with a short block: what was pinned, what was seen red, what turned
green, and the caller sweep results. If any caller could not be checked,
name it - do not imply coverage you did not verify.
`;

const PR_REVIEW_PASS = `---
name: pr-review-pass
description: Structured review of small feature PRs in three separate passes - correctness, then tests, then style - with each pass reported on its own. Use when reviewing a pull request or a diff under roughly 400 changed lines, especially when the review should end in actionable comments rather than a general vibe.
---

# PR Review Pass

## When to use

- Reviewing a feature PR or a focused diff (under ~400 changed lines)
- The review output must be concrete comments, not a summary

Do NOT use for giant refactors, generated code, or merges of other
people's long-lived branches. Say the PR is too big for this pass and
stop.

## The three passes - always in this order

### Pass 1: Correctness

Read the diff line by line. Hunt only for things that are WRONG:

- Off-by-one and boundary conditions
- Null/undefined paths the new code introduces
- Error handling that swallows or misroutes failures
- Race conditions in handlers the diff touches
- Behaviour the PR description promises but the code does not do

### Pass 2: Tests

- Is every new behaviour in Pass 1 covered by a test that would fail if
  the behaviour broke?
- Are the assertions checking behaviour, not implementation detail?
- Name the exact missing test cases - "add a test where X is null" -
  never "needs more tests".

### Pass 3: Style

Last, and clearly separated. Naming, structure, idioms. Cap this pass
at the five comments that matter most. If everything is fine, say so in
one line; do not manufacture style comments.

## Output format

Three headed sections, one per pass, in order. Each finding: file and
line, what is wrong, why it matters, a suggested change. End with a
verdict line: how many correctness issues, how many missing tests, how
many style notes.

## Hard boundaries

- Never approve or merge. The review is advice; the human decides.
- Never mix passes. A correctness bug reported in the style section
  gets ignored; keep the lanes clean.
- If you are unsure whether something is a bug, say "verify:" and ask
  the question instead of asserting it.
`;

const DESIGN_REVIEW_SWEEP = `---
name: design-review-sweep
description: Sweep named pages or screens for UX defects - dead ends, inconsistent type scale, missing empty and error states - and file each finding with evidence and a suggested fix. Use before shipping a flow, after a big UI change, or when a page "feels off" and needs concrete findings instead of vibes.
---

# Design Review Sweep

## When to use

- Pre-ship review of a user flow
- After a large UI change lands
- When a screen feels wrong but nobody can say why

This pack reports defects. It does not redesign, restyle, or rate taste.

## The sweep

Walk every page or screen you were given, in the states listed below.
For each finding, record: page, state, what is wrong, why it hurts, and
one suggested fix small enough to land in a single PR.

### 1. Dead ends

- Screens with no forward action and no way back
- Error states with no recovery path
- Success states that abandon the user ("done." - done, and now what?)

### 2. Type scale

- List every font size in use on the page
- Flag sizes that differ by 1-2px from a sibling (accidental, not
  hierarchical)
- Flag body text under 14px and tap targets under 44px

### 3. Missing states

Every list, form and async panel gets checked for four states:

- **Empty** - zero data, first run. Blank white is a bug.
- **Loading** - is there a skeleton or does the layout jump?
- **Error** - what does the user see when the request fails?
- **Overflow** - 10x the expected items, longest realistic name.

### 4. Consistency

- Same action, two different labels ("Delete" vs "Remove")
- Primary buttons that look different across sibling pages
- Spacing that follows no visible grid

## Output format

One section per page. Findings ordered: dead ends first, then missing
states, then type scale, then consistency. Each finding gets a severity:
blocks-users / annoys / polish.

## Hard boundaries

- Report, do not redesign. One suggested fix per finding, no mockups.
- No taste judgments ("ugly", "dated") - only consistency, states, and
  dead ends.
- If you cannot render a page, say which states you could not verify.
`;

const RESEARCH_BRIEF = `---
name: research-brief
description: Turn a loose question into a sourced brief where every claim carries a citation and a confidence tag, and unverifiable threads become open questions instead of smooth prose. Use for technology comparisons, market scans, "what's the current state of X" questions, and any answer that will drive a decision.
---

# Research Brief

## When to use

- "Should we use X or Y?" technology comparisons
- "What is the current state of Z?" landscape questions
- Any answer someone will rely on for a decision

## The format

### Question

Restate the question in one sentence, scoped tight enough to answer.

### Findings

One subsection per finding. Every claim gets:

- **Source** - a real, retrievable citation with its date
- **Confidence** - one of:
  - HIGH: primary source, recent, directly on point
  - MEDIUM: secondary source, or primary but dated/partial
  - LOW: single weak source, inference, or conflicting reports

A claim without a source does not go in Findings. It goes in Open
Questions.

### Open Questions

Everything you could not verify, stated as plainly as the findings.
"Unknown" is a valid and valuable result. Never launder an open
question into a finding by softening the wording.

### So what

Two or three sentences: what this means for the decision at hand. If
the evidence is too thin to recommend, say that.

## Rules

- Prefer primary sources: official docs, release notes, pricing pages,
  the repo itself. Blogs citing blogs is a trail to follow, not a
  source to cite.
- Record retrieval dates. Prices, limits and terms rot fast.
- When sources conflict, report the conflict with both citations.
  Never average away a disagreement.
- Keep the brief under one page of prose. If it is longer, the question
  was not scoped tightly enough.

## Hard boundaries

- No claim without a citation or a confidence tag.
- No hiding low-confidence claims in confident prose.
- No answering what was not asked - park adjacent discoveries in a
  one-line "also seen" note.
`;

const MIGRATION_DRY_RUN = `---
name: migration-dry-run
description: Rehearse a database schema migration against a throwaway copy before the real window. Use when a migration touches a table that matters - adds columns, rewrites rows, drops or renames anything - and you need to know what breaks, what locks, and how long it takes before production finds out.
---

# Migration Dry Run

## When to use

- A migration rewrites, renames, or drops columns on a live table
- The change window is short and a surprise lock or full-table
  rewrite would blow it

Do NOT use for additive-only changes on small tables (new nullable
column, new table). Say the migration is low-risk and stop.

## Setup: the throwaway copy

1. Never rehearse against production. Restore a recent dump or
   snapshot into a scratch database with the same engine version.
2. Note the row counts of the tables the migration touches. If the
   copy is much smaller than production, say so - timing findings
   scale with table size and cannot be quoted as production numbers.
3. Record the engine and version. Lock behaviour differs across
   versions; a finding without a version is not a finding.

## The rehearsal

1. Apply the migration to the copy exactly as the deploy will run it -
   same tool, same order, same transaction settings.
2. Time each statement. Flag any statement that rewrites the table
   (type changes, defaults with backfill, index drops on large
   tables) separately from metadata-only changes.
3. Check what the application does DURING the migration: run the
   current code against the half-migrated schema if the deploy and
   migration are not atomic.
4. Roll back once, then VERIFY the rolled-back copy: row counts and
   spot-checked data match the pre-migration state. A down-migration
   that runs is not proof - dropped or renamed columns lose data
   silently. A migration that cannot be reversed in the window is a
   finding, not a footnote; name any step that loses data as
   irreversible, not merely "cannot undo".

## Output format

One line per statement: what it does, how long it took on the copy,
whether it locks or rewrites. Then three lists:

- **Will break**: code paths that fail against the new schema
- **Will wait**: statements that hold locks, with the rough hold time
- **Irreversible**: steps with no safe rollback inside the window,
  with data-loss steps called out by name

End with a go/no-go recommendation and the conditions attached.

## Hard boundaries

- Never run against production or a production replica with traffic.
- Never quote copy timings as production timings - report the size
  ratio next to every number.
- If the copy cannot be made representative, say the rehearsal is
  inconclusive instead of guessing.
`;

const FLAKY_TEST_HUNTER = `---
name: flaky-test-hunter
description: Prove whether a suspect test is actually flaky before anyone edits it or the code under it. Use when a test passes and fails without code changes - re-runs it under shuffled order, random seeds, and repeated execution, then separates order-dependence from time-dependence from genuine product bugs.
---

# Flaky Test Hunter

## When to use

- A test fails intermittently with no related code change
- Someone is about to "fix" it by deleting or weakening it

Do NOT use on tests that fail consistently. A consistent failure is a
bug report, not a flake - hand it back as one.

## Phase 1: Reproduce the flake

1. Run the suspect test alone, N times. Record pass/fail per run -
   never just the summary. Pick N from the failure rate you need to
   rule out: N=20 misses a 5% flake about 36% of the time and a 1%
   flake about 82% of the time. State your N and the miss probability
   you accepted.
2. Run the full file it lives in, N times, same recording.
3. Run the whole suite once with a random order seed, twice with two
   different fixed seeds.
4. Run the suite (or the file it lives in) once serial and once with
   parallel workers. A test that passes alone but fails only under
   parallelism points at shared ports, databases, or files - add that
   to the classification.

If the test never fails in any of these, report "not reproduced" and
name the conditions tried. Do not call it fixed.

## Phase 2: Classify the flake

Match the failure pattern to a cause before touching anything:

- **Order-dependent**: fails only after certain other tests run.
  Isolate the polluter: bisect by running the suspect test after each
  candidate predecessor (or the test runner's bisect mode) until one
  predecessor flips the result. Hunt for the shared state - globals,
  databases, files, env vars - that predecessor leaves dirty, and name
  the polluting test in the report.
- **Time-dependent**: fails under load, at certain wall-clock times,
  or near timeouts. Hunt for sleeps, fixed dates, and races.
- **Environment-dependent**: fails on one OS, CI runner, or machine
  only. Diff the environments before blaming the test.

## Phase 3: Fix the cause - never the symptom

The fix goes where the cause lives: reset the dirty state, inject the
clock, await the async work. Quarantining or retrying the test is a
last resort and must be labeled as such in the report.

## Output format

Report: the reproduction rate (x of N, with N and its miss
probability), the classification, the smallest condition that triggers
it, the polluting test if order-dependent, and the shared state or
race responsible.

## Hard boundaries

- Never delete, skip, or loosen a flaky test to make CI green.
- Never report a flake without the reproduction rate and the seeds
  tried.
- If the flake turns out to be a real product bug, say so plainly -
  that is a win, not a scope violation.
`;

const ENV_CONFIG_DOCTOR = `---
name: env-config-doctor
description: Audit environment variables across .env files, code usage, and deploy configuration before they bite. Use when a deploy fails with a missing or malformed config value, when environments drift apart, or before adding a new environment - finds used-but-unset vars, set-but-unused vars, and shape mismatches between environments.
---

# Env Config Doctor

## When to use

- "Works locally, 500s in production" with config in the stack trace
- Before promoting a change to a new environment
- Periodic drift check on a project with several .env files

Do NOT print secret values. Names and shapes only - a report that
leaks a value is worse than the drift it found.

## The three-way diff

Build three sets, then compare them pairwise:

1. **Used in code**: every var the code reads (process.env, import.meta,
   config loaders). Note where each is read and whether it has a
   fallback default.
2. **Set somewhere**: every var defined in .env files, deploy config,
   CI secrets lists, container definitions. Record which file or
   system sets each - never the value.
3. **Documented**: every var in the README, .env.example, or setup
   docs.

## Findings to report

- **Used but unset**: code reads it, nothing sets it in this
  environment. This is the 500 waiting to happen.
- **Set but unused**: defined but never read - stale config that
  confuses the next person. Mark for removal, do not remove.
- **Undocumented**: set and used, but missing from .env.example -
  the next setup will miss it.
- **Shape mismatch**: same var, different shape across environments -
  URL with and without a path, port as string vs number, boolean as
  "1" vs "true". Validate shape, not just presence.
- **Unreadable sources**: every config source you could not inspect
  (locked deploy dashboards, CI secrets you cannot list). A var is
  never "unset" in an environment you could not read - it is unknown,
  and the report names which sources were out of reach.

## Output format

One table per finding class, columns: variable, where used, where set,
what is wrong, suggested fix. End with a count summary and the single
most dangerous finding called out by name.

## Hard boundaries

- Never print, copy, or exfiltrate secret values - names and shapes
  only.
- Never "fix" drift by editing env files yourself; report and let the
  owner decide which environment is right.
- Treat a missing fallback as a finding only when the code crashes or
  misbehaves without it; some vars are legitimately optional.
`;

const EMPTY_STATE_AUDIT = `---
name: empty-state-audit
description: Find screens that render blank, broken, or misleading with zero data, and draft an empty state for each. Use after building list, dashboard, inbox, or search screens - anywhere a first-run account, a cleared view, or a failed load can leave the user staring at nothing.
---

# Empty State Audit

## When to use

- A screen shows a list, table, feed, chart, or search results
- The product is about to get new users who start with zero data

Do NOT use to redesign states that already exist and work. If a screen
handles empty well, say so and move on.

## Inventory: find every emptiable surface

1. List the screens that render collections or fetched data.
2. For each, force the four empty conditions - they fail differently:
   - **First run**: account created, nothing added yet
   - **Cleared**: data existed, user removed all of it
   - **No results**: filters or search exclude everything
   - **Failed load**: the request errored, nothing to show
   - **Permission-denied**: data exists but this user may not see it.
     This is NOT an empty state - say access is missing; never draft
     "create your first item" copy for something the user cannot create
3. Screenshot or describe what actually renders for each condition.
   A spinner that never resolves and a stack trace both count as
   findings.

## Draft each empty state

Every empty state answers three questions in this order:

1. **What is this?** One line naming what will live here.
2. **Why is it empty?** First run, cleared, no results, or error -
   say which, honestly.
3. **What next?** One primary action: create the first item, clear
   the filter, retry the load. Never more than one primary action.

Rules per condition: first-run states teach and invite; cleared
states confirm and offer undo if possible; no-results states name the
filter that hid everything; error states say what failed and offer
retry - they never pretend to be an empty list.

## Output format

Per screen: the condition, what renders today, the drafted copy
(headline, one supporting line, one action label), and any data the
state needs that the screen does not currently have.

## Hard boundaries

- Never show fake rows, skeletons that never resolve, or dummy data
  to fill an empty screen.
- Never blame the user ("you have no friends yet") - frame empty as
  the starting point, not a failure.
- An error state must not look like a successful empty list.
`;

const COPY_TONE_PASS = `---
name: copy-tone-pass
description: Review UI copy against a tone sheet and flag off-voice strings with concrete rewrites. Use when an interface has grown copy from many hands and the voice has drifted - buttons, errors, empty states, confirmations, emails. The writer keeps the last word; this pass finds and proposes, never overwrites.
---

# Copy Tone Pass

## When to use

- UI copy comes from many authors and the voice has drifted
- A tone sheet or style guide exists (even a short one)

Do NOT use without a tone reference. If none exists, draft three
candidate tone rules from the best existing copy, get them confirmed,
and only then audit against them.

## Collect the strings

1. Gather user-visible strings: buttons, labels, errors, empty
   states, confirmations, toasts, emails, onboarding.
2. Group by surface (forms, errors, navigation, marketing) - tone
   rules often differ per surface, and an error page is not a
   settings label.
3. Note the source file for each string so findings land where the
   copy lives.
4. Cap the pass. On a large app, every string is a crawl, not a
   review: sample the top surfaces by traffic or the first N strings
   (default N=200), and state the coverage in the output.

## Judge against the sheet, not your taste

Flag a string only when it breaks a rule on the sheet:

- **Register**: too formal or too casual for the surface
- **Person and tense**: "we have created" vs "you created" drift
- **Jargon**: words the sheet bans (leverage, utilize, please note)
- **Blame**: errors that accuse the user ("you entered a bad...")
- **Caps and punctuation**: Title Case vs sentence case, exclamation
  marks where the sheet allows none

If a string is off-voice but breaks no written rule, list it under
"judgment calls" separately - do not invent rules to convict it.

## Propose, never overwrite

Each finding: the string, the rule it breaks, a suggested rewrite,
and why the rewrite follows the rule. One rewrite per string - three
options is indecision, not help.

## Output format

Grouped by surface, then by rule. End with counts per rule broken and
the three highest-visibility strings to fix first - visibility from a
usage signal you actually gathered (page views, entry-point screens).
If you have no traffic data, say so and rank by surface prominence;
never present a guess as traffic.

## Hard boundaries

- Never rewrite strings in place; the writer decides.
- Never flag style preferences as rule violations.
- Errors and legal-adjacent copy (deletion, payment, data export)
  get extra care: clarity beats voice there, every time.
`;

const A11Y_QUICK_SCAN = `---
name: a11y-quick-scan
description: Keyboard-path and contrast sweep of named pages with fixes ranked by how many users they block. Use before shipping a page or flow, or when an accessibility complaint arrives - a fast, concrete pass that produces small fixes landable in the same PR, not a WCAG dissertation.
---

# A11y Quick Scan

## When to use

- Before shipping a new page, form, or flow
- After any report that someone "can't use" part of the product

Do NOT present this as a full WCAG audit. It is a quick scan of the
named pages; say exactly what was and was not covered.

## Pass 1: Keyboard only

Put the mouse away. For each named page:

1. Tab through start to finish. Every interactive element must be
   reachable in a sensible order, with a visible focus indicator.
2. Operate everything with keyboard alone: menus, modals, dropdowns,
   date pickers, drag lists.
3. Traps and escapes: a modal must trap focus while open and release
   it on close; Escape must close what looks closable.
4. Note every stop where focus vanishes, order jumps, or a control
   cannot be operated.

## Pass 2: Contrast and meaning

1. Body text and interactive labels: check contrast against their
   actual background, including hover, disabled, and placeholder
   states. Flag pairs below 4.5:1 (3:1 for large text).
2. Meaning without color: errors marked only in red, required fields
   marked only by color, charts readable in grayscale.
3. Names and labels: icon-only buttons need an accessible name;
   inputs need a label that is not just placeholder text.
4. Non-text contrast: focus indicators and the visual boundaries of
   interactive components need 3:1 against adjacent colors (WCAG
   1.4.11). A focus ring you can barely see fails Pass 1's "visible"
   requirement - judge it against this threshold.

## Rank by users blocked

Rank every finding: a broken keyboard path on the checkout button
outranks a low-contrast footer link. For each: what is wrong, who it
blocks, and the smallest fix that unblocks them - each small enough
to land in the same PR.

## Output format

Findings ranked, one per line: element and page, the failure, the
fix. Then a coverage note: pages scanned, passes completed, known
gaps (screen-reader pass, zoom to 200%, motion) not covered here.

## Hard boundaries

- Never claim compliance; claim what was tested and what passed.
- Never fix contrast by changing brand colors silently - propose the
  change, name the rule it satisfies.
- If automated tooling was used, verify its flags by hand before
  reporting them; tool noise is not a finding.
`;

const COMPETITOR_SCAN = `---
name: competitor-scan
description: Build a cited feature and pricing comparison of named competitors from public sources only. Use when choosing between tools, positioning a product, or answering "how do we compare" - every cell carries its source and retrieval date, and unknown cells stay unknown instead of being filled with guesses.
---

# Competitor Scan

## When to use

- A feature or pricing decision needs competitive ground truth
- A comparison table will be shown to people who will check it

Do NOT use for confidential or leaked information, and do not
estimate a competitor's private numbers. Public sources only.

## Scope first

1. Fix the competitor list with the requester - never expand it
   silently mid-scan.
2. Fix the feature axes before collecting: which capabilities, which
   price points, which limits (seats, requests, storage). Changing
   axes halfway invalidates collected cells.
3. Fix the date. Prices rot; the table must say when each cell was
   retrieved.

## Collect with sources

For every cell:

1. Go to the primary source: the vendor's pricing page, docs, or
   public changelog - not a review site summarizing them.
2. Record the URL, the retrieval date, AND a dated quote of the
   exact source line behind each value. Pricing pages change; a link
   alone does not prove what the page said on the day.
3. Read the fine print: per-seat vs per-team, monthly vs annual
   pricing, free-tier limits, "contact us" tiers. A price without
   its unit is not a price.
4. If a cell cannot be confirmed from a public source, write
   "not published" - never interpolate from a competitor's blog
   post or your own assumption.

## Compare honestly

- Mark cells where you are comparing different units (per-seat vs
  flat) instead of forcing them into one number.
- Keep "best" claims out of the table. The table shows facts; the
  summary may recommend, with reasons.
- When one axis clearly wins per use case, say which use case -
  "cheapest for a 5-person team" beats "cheapest".

## Output format

The table: rows are competitors, columns are the fixed axes, each
cell is value + source + date. Below it: cells that could not be
verified, and a dated summary of what changed since the last scan if
one exists.

## Hard boundaries

- No confidential, scraped-behind-login, or leaked data.
- No unsourced cells. "Not published" is a valid and useful cell.
- Prices change: a table older than ~90 days is stale - say so.
`;

const PAPER_TRAIL = `---
name: paper-trail
description: Trace a claim back through its citation chain to the primary source and rate each hop. Use when a number, quote, or "study shows" claim matters - a decision, a publication, a pitch - and you need to know whether the chain underneath it is solid or goes soft before it reaches anything primary.
---

# Paper Trail

## When to use

- A load-bearing claim rests on "a study", "reports say", or a
  statistic with no visible origin
- Before citing a claim onward in something the user will publish

Do NOT use for claims nobody is relying on. Tracing is work; spend it
where being wrong would cost something.

## Walk the chain

1. Start from where the claim was found. What exactly does it cite?
2. Follow each hop: article to article, article to press release,
   press release to paper, paper to dataset. Record each hop with
   its URL and what it actually says.
3. Stop at the primary source - the original study, dataset, or
   direct statement - or at the point the chain dead-ends.
4. A dead end is a finding: "cited everywhere, sourced nowhere"
   happens more than anyone expects.

## Rate each hop

- **Primary**: original study, dataset, transcript, direct quote.
  Flag when the primary source IS the claimant - a vendor press
  release, an author's own blog, a company reporting its own numbers.
  That is primary by provenance and self-interested by credibility;
  the report must say both.
- **Secondary**: reports on the primary source accurately, with a
  working link to it - and "working" means you opened it: confirm the
  link lands on the claimed primary source, not a homepage or a dead
  page. Link rot is a finding, not a pass.
- **Soft**: blog-of-a-blog, no link, misquoted numbers, or a claim
  that mutated between hops (300 becomes "hundreds" becomes "most").
- **Broken**: the cited source says something different, or nothing
  at all.

Watch for the classic mutations: sample size shrinking, correlation
becoming causation, "in one small study" becoming "proven", and dates
quietly moving.

## Output format

The chain as a list, each hop rated, with the exact sentence at each
step that carries (or fails to carry) the claim. Then the verdict:
what the claim can honestly support - the strong version, the weak
version, or nothing.

## Hard boundaries

- Never upgrade a claim beyond what the primary source supports.
- Never treat a popular claim as a verified one; repetition is not
  evidence.
- If the primary source is paywalled or gone, say the trail is
  unverifiable - do not launder it through a summary of a summary.
`;


export const SKILL_FILES: Record<string, { filename: string; content: string }> = {
  "api-change-safety-net": { filename: "api-change-safety-net.SKILL.md", content: API_CHANGE_SAFETY_NET },
  "pr-review-pass": { filename: "pr-review-pass.SKILL.md", content: PR_REVIEW_PASS },
  "design-review-sweep": { filename: "design-review-sweep.SKILL.md", content: DESIGN_REVIEW_SWEEP },
  "research-brief": { filename: "research-brief.SKILL.md", content: RESEARCH_BRIEF },
  "migration-dry-run": { filename: "migration-dry-run.SKILL.md", content: MIGRATION_DRY_RUN },
  "flaky-test-hunter": { filename: "flaky-test-hunter.SKILL.md", content: FLAKY_TEST_HUNTER },
  "env-config-doctor": { filename: "env-config-doctor.SKILL.md", content: ENV_CONFIG_DOCTOR },
  "empty-state-audit": { filename: "empty-state-audit.SKILL.md", content: EMPTY_STATE_AUDIT },
  "copy-tone-pass": { filename: "copy-tone-pass.SKILL.md", content: COPY_TONE_PASS },
  "a11y-quick-scan": { filename: "a11y-quick-scan.SKILL.md", content: A11Y_QUICK_SCAN },
  "competitor-scan": { filename: "competitor-scan.SKILL.md", content: COMPETITOR_SCAN },
  "paper-trail": { filename: "paper-trail.SKILL.md", content: PAPER_TRAIL },
};
