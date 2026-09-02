---
premise: grep -q "the human.s act of approval" docs/pr-prompts/PROMPT-SCHEMA.md
premise_means: >-
  PROMPT-SCHEMA.md:186 reads "Removing the label is the human's act of approval. Review the PR,
  remove do-not-merge, CI re-runs..." - addressed to "the human", with no named actor. Every other
  binding document names Marco and only Marco: STATION-CAPABILITIES.md:176 "only Marco removes
  it", docs/approvals/README.md:68 "only Marco removes it", 00-supervisor.md:162 and
  02-board-driver.md:151 "you never remove a do-not-merge label". PROMPT-SCHEMA.md is the document
  a prompt author reads, and an agent reading "the human" can cast itself as the reviewing human.
  The string "only Marco" appears 0 times in the file (control: "premise" appears 15 times).
  Measured 2026-09-01T03:0xZ at 1efd079c.
scope:
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: >-
  grep -q "only Marco" docs/pr-prompts/PROMPT-SCHEMA.md && ! grep -q "the human.s act of approval"
  docs/pr-prompts/PROMPT-SCHEMA.md
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# PROMPT-SCHEMA says "the human" removes do-not-merge; every other binding doc says only Marco

## The defect

`docs/pr-prompts/PROMPT-SCHEMA.md:186`:

> **Removing the label is the human's act of approval.** Review the PR, remove `do-not-merge`, CI
> re-runs, CP-26 passes, and the PR becomes mergeable. Nothing else is required, and nothing can
> merge it while the label is on.

Everything in that paragraph is mechanically true. The gap is the actor. "The human" is
unqualified, and this is the file a prompt author reads while writing the very prompts that carry
`escalates: true`. An agent that has just been told it is the reviewer of record can read "review
the PR, remove `do-not-merge`" as an instruction addressed to itself.

Every other binding document is explicit, and they disagree with this one only by being specific:

| Document | Line | Text |
|---|---|---|
| `docs/pipeline/STATION-CAPABILITIES.md` | 176 | "The `do-not-merge` label (CP-26 / `escalates: true`) - **only Marco removes it.**" |
| `docs/approvals/README.md` | 68 | "the `do-not-merge` label (CP-26 / `escalates: true`) - only Marco removes it" |
| `docs/pipeline/stations/00-supervisor.md` | 162 | "**you never remove a `do-not-merge` label**" |
| `docs/pipeline/stations/02-board-driver.md` | 151 | "**never remove a `do-not-merge` label**" |

`grep -c "only Marco" docs/pr-prompts/PROMPT-SCHEMA.md` returns **0** today (control: `premise`
returns 15), so the phrase that resolves the ambiguity is simply absent from the file.

## Why this is worth a PR rather than a shrug

The label has been removed by an unattributable actor repeatedly - the supervisor breadcrumbs on
`origin/main` record it on `#1325` (2026-08-26), `#1349` (2026-08-27), `#1431` (2026-08-31) and
`#1443` (2026-08-31, logged as "the SIXTH occurrence"). Marco has since confirmed the recent ones
were him or directed by him, so this prompt is **not** claiming a breach. It is closing the one
gap that made those events ambiguous in the first place: every actor on this board authenticates as
`GH-Mantova`, so a label removal carries no attribution, and the only defence available is that
every document an actor might read says the same thing. One of them does not.

## What to build

A single wording change in `docs/pr-prompts/PROMPT-SCHEMA.md`.

1. Rewrite the sentence at `:186` so the actor is named. It must contain the literal string
   `only Marco`, and it must no longer contain `the human's act of approval`. Keep the mechanical
   description that follows - review, remove, CI re-runs, CP-26 passes, PR becomes mergeable -
   because that part is correct and prompt authors rely on it.
2. Add one sentence stating that no station and no automation removes the label, and pointing at
   `docs/pipeline/STATION-CAPABILITIES.md` section 5 as the authority. Keep it to a sentence; this
   file is a schema, not a policy document.
3. Change nothing else in the file.

## Do NOT

- 🔴 **Do NOT edit anything under `docs/pr-reviews/`.** `pr-1165-review.md:25` and
  `pr-1435-review.md:16` contain similar wording, but those are **historical review records** of
  what was said at the time. They are evidence, not instructions, and rewriting them destroys the
  record. They are outside `scope` for this reason.
- Do NOT edit `docs/pipeline/DOCTRINE.md`. Section 9 sits inside a hash-gated canonical block and
  `lint-station.mjs` fails on any edit to it without a re-recorded hash. Nothing here needs it.
- Do NOT edit the station docs, `STATION-CAPABILITIES.md` or `approvals/README.md` - they are
  already correct, and this prompt exists to make the schema agree with them, not the reverse.
- Do NOT remove, add or alter any `do-not-merge` label on any PR as part of this work. That is
  precisely the act this prompt is about.
- Do NOT touch `/sot/`, `scripts/**`, `apps/**` or any file outside `scope`. This must stay
  docs-only so it lands through the `tests-docs` policy gate.
- Do NOT run `git checkout .`, `git checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`
  anywhere.

## VERIFY

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-schema-label-removal-is-marcos-ready.md
grep -q "only Marco" docs/pr-prompts/PROMPT-SCHEMA.md
! grep -q "the human.s act of approval" docs/pr-prompts/PROMPT-SCHEMA.md
git diff --stat origin/main -- docs/pr-prompts/PROMPT-SCHEMA.md
```

The `--stat` must show one file and a handful of lines. A large line count means the editor
rewrote line endings or re-encoded the file - see DOCTRINE section 9.3 and fix it before pushing.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - say `NO-OP: <reason>` if you do nothing.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the job log before diagnosing any CI failure; never reason a red out of the diff.
- Before you finish, ask: is there a PR number in my output?
