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

export const SKILL_FILES: Record<string, { filename: string; content: string }> = {
  "api-change-safety-net": { filename: "api-change-safety-net.SKILL.md", content: API_CHANGE_SAFETY_NET },
  "pr-review-pass": { filename: "pr-review-pass.SKILL.md", content: PR_REVIEW_PASS },
  "design-review-sweep": { filename: "design-review-sweep.SKILL.md", content: DESIGN_REVIEW_SWEEP },
  "research-brief": { filename: "research-brief.SKILL.md", content: RESEARCH_BRIEF },
};
