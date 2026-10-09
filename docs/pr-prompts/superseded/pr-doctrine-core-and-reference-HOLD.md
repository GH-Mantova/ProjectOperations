---
premise: '! test -f docs/pipeline/DOCTRINE-REFERENCE.md'
premise_means: >-
  The binding reading every Station 00 run must do before working is about 60,000 words, more than a
  run reliably carries, so runs skim and each reads a different part. MEASURED 2026-10-03 at
  origin/main 8ed747e0: docs/pipeline/DOCTRINE.md is 3,001 lines (~35,700 words), of which section 9
  (the shell, git, files, GitHub and instrument traps; headings "## 9.1" to "## 9.6") runs from line
  394 to line 2236, about 1,840 lines. docs/pipeline/stations/00-supervisor.md is 1,714 lines
  (~17,700 words) and STATION-CAPABILITIES.md is 592 lines (~6,700 words). Source:
  needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md.
done_when: >-
  pnpm build && pnpm lint &&
  test -f docs/pipeline/DOCTRINE-REFERENCE.md &&
  test -f docs/pipeline/stations/00-supervisor-REFERENCE.md &&
  test "$(wc -l < docs/pipeline/DOCTRINE.md)" -le 700 &&
  test "$(wc -l < docs/pipeline/stations/00-supervisor.md)" -le 600 &&
  grep -q "DOCTRINE_CORE_SPLIT_V1" docs/pipeline/DOCTRINE.md &&
  node scripts/pipeline/lint-station.mjs &&
  node --test "scripts/pipeline/__tests__/*.mjs"
scope:
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/DOCTRINE-REFERENCE.md
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/00-supervisor-REFERENCE.md
  - docs/pipeline/stations/_canonical-blocks.json
  - docs/pipeline/STATION-CAPABILITIES.md
  - scripts/pipeline/lint-station.mjs
  - scripts/pipeline/__tests__/lint-station.reference-files.test.mjs
size: 5
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Text moves between files; nothing is deleted. Reverting the PR restores the two original files
  byte-for-byte.
escalates: true
module: pipeline
---

# DOCTRINE and the Station 00 doc: a short binding core, plus a look-up reference

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-03)

**A short core plus a look-up reference.** The binding core holds the rules and is read every run.
The reference holds the incident write-ups and tool traps, indexed by topic, and is consulted when a
task touches that area. The same split applies to Station 00's own instructions. **Nothing is
deleted.** Marco reviews the core's wording before it takes effect (this PR escalates).

## Go / no-go: arm this last

This PR moves large blocks of `DOCTRINE.md` and `00-supervisor.md`.
Other staged prompts edit those files, so their changes must be on main first. **Check each needle
with `git grep -q <needle> origin/main`:**

`BOARD_LEASE_V1`, `FRESHNESS_ONE_CADENCE_V1`, `UPDATE_AT_MERGE_TIME_V1`,
`RETIRE_TESTS_DOCS_LANE_V1`, `INSTRUMENT_LANE_V1`, `DISPATCH_REGISTER_V1`,
`RETIRE_ESCALATION_V1`, `MARCO_QUEUE_LINE_V1`, `CP26_ARMED_BY_DIFF_V1`.

If any needle is missing, print `NO-OP: waiting for <needles> to land before splitting DOCTRINE`
and stop. The one exception is a prompt Marco has withdrawn: if its prompt file is in
`docs/pr-prompts/superseded/`, skip its needle. Check needles rather than file names, because a
consumed prompt can stay on main as `-HOLD.md`.

Tag the core files with `DOCTRINE_CORE_SPLIT_V1`.

## 1. `docs/pipeline/DOCTRINE.md` becomes the core (≤ 700 lines)

- Keep **every numbered heading and its number** (`## 1.` … `## 10.6`, plus `7.1`, `8.x`, `9.x`), so
  every existing citation like "DOCTRINE §9.4" or "section 10.3" still resolves.
- Under each heading, keep the **rule itself**: what to do, what never to do, and the hard stops. Keep
  it short: a few lines, or the full text where the section is already short (sections 1-6 and 7.1
  are rules and should stay nearly whole).
- Move the **evidence**: incident narratives, measurement tables, dated corrections, worked
  examples and long rationale. For each moved section, end the core text with
  `Full detail: DOCTRINE-REFERENCE.md §<same number>.`
- Section 9 shrinks to one short block per trap: the trap name, the one-line symptom, the one-line
  cure. The full write-ups move.
- Add a 5-line preamble: the core is read in full every run; the reference is read when the task
  touches a topic, and **always** before acting on a matching trap.
- **Do not change the meaning of any rule.** Where condensing one would change what an agent does,
  keep the original wording. List every section where you kept full text for that reason.

## 2. `docs/pipeline/DOCTRINE-REFERENCE.md` (new)

- The same headings and numbers, holding the moved text **verbatim**: no rewording, no dropped
  tables.
- A topic index at the top: shell, git, files and encoding, GitHub, instruments, board, merging. Each
  entry points to its section numbers.

## 3. `docs/pipeline/stations/00-supervisor.md` (≤ 600 lines) and `00-supervisor-REFERENCE.md`

Apply the same rules. The core keeps the PREFLIGHT, the report contract, BOARD DRIVING (the four
conditions), the COLLECT steps and the hard stops. Measured incidents, worked examples and dated
corrections move verbatim to the reference, under the same headings, with `Full detail:` pointers.

## 4. `scripts/pipeline/lint-station.mjs`

- Lint the two REFERENCE files too: the same path and citation checks.
- Required-section and canonical-block checks still apply to the core files. Re-record canonical
  hashes with `--write-canonical` and commit `_canonical-blocks.json`.
- New check: every `Full detail: <file> §<n>` pointer must resolve to an existing heading in that
  file.

New test `scripts/pipeline/__tests__/lint-station.reference-files.test.mjs`:

1. A dangling `Full detail:` pointer is a REJECT.
2. A valid pointer passes.
3. **Negative control:** a core file with no pointers lints exactly as before.

## 5. `docs/pipeline/STATION-CAPABILITIES.md`

Where it describes the binding read, say: core files in full every run, REFERENCE files on demand
and before acting on a matching trap. Do not split this file in this PR; its size is not the problem.

## Proof in the PR body

1. Line and word counts, before and after, for all four files.
2. **Nothing lost:** after the PR, the concatenation of core plus reference must contain every
   non-heading line of the original file. Run a script that checks each original line appears in one
   of the two new files, allowing only the new pointer and preamble lines as additions. Paste its
   output, including any line it could not find.
3. A list of sections where the core keeps full text, and why.

## Follow-up outside this PR

The scheduled-task bootstraps tell each run to "read these three in full". Once this merges,
Station 06 updates them on Marco's PC (with a backup) to say: core files in full, REFERENCE on
demand. State that in the PR body.

`escalates: true`: it changes the binding text every station reads. The PR opens labelled
`do-not-merge`, and Marco reviews the core wording and releases it.
