---
premise: '! grep -q "AUTOMATIC_VARIABLE_ASSIGNMENT_V1" docs/pipeline/DOCTRINE.md'
premise_means: DOCTRINE section 9.1 does not yet carry a bullet for PowerShell read-only automatic variables, so the marker string is absent.
scope:
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
done_when: grep -q "AUTOMATIC_VARIABLE_ASSIGNMENT_V1" docs/pipeline/DOCTRINE.md && node scripts/pipeline/lint-station.mjs
size: 2
gate_allow: none
seed_only: false
escalates: false
module: ''
---

# DOCTRINE section 9.1 — a PowerShell read-only automatic variable silently voids the loop that uses it

Staged by Station 04, 2026-09-07T22:2xZ, during the `instrument-honesty` sweep, at `origin/main`
`0eca4c55`. **Marker for this work: `AUTOMATIC_VARIABLE_ASSIGNMENT_V1`.**

This is a **docs-only** change. It touches `docs/pipeline/` and nothing else, so it is eligible for
the `tests-docs` auto-merge lane.

## Why this is needed

Station 04 hit this live, in its own probe script, while re-proving the section 9 trap list. A
`foreach ($home in @(<three paths>)) { ... }` loop over the three `docs/pr-reviews/` homes produced
**zero rows** and the script still ran to completion and exited 0. The cause is not the paths and not
the filesystem: `$home` is a PowerShell **read-only automatic variable**, so binding it as a loop
variable throws `SessionStateUnauthorizedAccessException: Cannot overwrite variable HOME because it
is read-only or constant` — once, into the error stream — and the loop body **never executes.**

Two things make this section 9 material rather than a typo:

1. **It is section 9.6's exact shape.** Nothing is empty because the world is empty; the loop that
   would have measured the world never ran. The available conclusion from the surviving output is
   *"all three review homes are empty"*, which is false — measured the same minute, the three homes
   held 106, 61 and 623 review files.
2. **PowerShell variable names are case-insensitive**, so `$home` collides with `$HOME`. Section 7's
   standing guard 5 already records the case-insensitivity family (`$c` clobbering `$C`) and section
   7's lie 5 is its worked example — but that guard says *"no single-letter variables"*, which does
   not reach a descriptive lowercase name like `$home`, `$host`, `$input`, `$pwd`, `$args` or
   `$matches`. A reader following guard 5 to the letter still writes this bug.

## The work

### 1. Add ONE bullet to DOCTRINE section 9.1, after the blocked-commands bullet

It must carry the marker string `AUTOMATIC_VARIABLE_ASSIGNMENT_V1` verbatim (that is the premise and
the `done_when`), and it must contain, in this order:

- the rule: **never bind a PowerShell automatic variable as a loop or assignment target**, and prefer
  a name no automatic variable can shadow;
- the measured instance above, tagged `[MEASURED] 2026-09-07T22:2xZ by Station 04`, including that
  the script exited 0 and the loop body never ran;
- the reason it is not covered by section 7 guard 5 (that guard is scoped to single-letter names);
- the named falsifying probe: run
  `powershell -NoProfile -Command "foreach ($home in @(1,2,3)) { $home }"` — if it prints `1 2 3`,
  this bullet is wrong and must be re-measured;
- the cure: pick a non-automatic name (`$reviewHome`), and **control any `foreach` that produces no
  rows against an input you know is non-empty** — a loop that never ran and a loop over an empty
  collection are byte-identical in the output.

**Keep it short.** One bullet in the established shape. Do not restate section 7 guard 5; point at it.

### 2. Correct the stale control inside the section 9.5 `LINT_GH_BIN` bullet

That bullet ends with a parenthetical asserting the control returns *exactly one hit*. **[MEASURED]
2026-09-07T22:2xZ at `0eca4c55`:** `LINT_GH_BIN` now occurs on **two** lines of
`origin/main:scripts/pipeline/lint-prompt.mjs` — a comment line and the live
`const gh = process.env.LINT_GH_BIN || "gh";`. The bullet's conclusion is unchanged and is now better
supported, but the count is **state written into an instruction document**, which is the failure
section 9.5's own closing bullet records. **Delete the count; keep the anchor.** Do not replace it
with today's number — that only resets the same clock.

### 3. Re-record the canonical hash

Both edits land inside `<!-- CANONICAL-BLOCK: instruments v2 -->`, which is hash-gated. After
editing, run:

```
node scripts/pipeline/lint-station.mjs --write-canonical
```

and commit the regenerated `docs/pipeline/stations/_canonical-blocks.json` **in the same PR**. The
`instruments` block lives in DOCTRINE only, so the re-record costs **one** document, not seven —
expect the pre-fix lint to read `REJECT` for a single file, and the post-record lint to pass. Verify
with a bare `node scripts/pipeline/lint-station.mjs` before opening the PR; that command is the
`done_when`.

## Scope discipline

- **Docs only.** Do not touch `apps/`, `scripts/`, `.github/`, `packages/` or `sot/`. Mixing `sot/`
  with anything else hard-fails CP-24.
- Do not add any other state to section 9. Every new factual line carries `[MEASURED]` /
  `[INFERRED]` / `[CANNOT MEASURE]`, a UTC stamp and the SHA it was true at, and any claim about a
  fix that has not landed must name the probe that would falsify it.
- Do not renumber, reorder or reflow the surrounding bullets — a whitespace-only reflow of a
  hash-gated block makes the diff unreadable and the re-record unverifiable.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
