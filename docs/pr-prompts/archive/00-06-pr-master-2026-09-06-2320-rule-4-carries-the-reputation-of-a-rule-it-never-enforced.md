# Station 06 — 2026-09-06 23:20Z — RULE 4 carries the reputation of a rule it never enforced

## GROUND

`origin/main` = `734ff8c9`. Interactive run, Marco present. Station 06 designs and STAGES; it never
arms and never merges. Marco asked for the narrow guard staged and the broader question drafted as a
brief he can react to.

## WHAT I MEASURED

`arm-prompt.ps1` guards an exclusive OS lock on `.git\po-arm.lock`, a lint gate, index guards before
and after the rename, `ARM_INDEX_RELEASED`, and an audit line — and **never asks whether another
prompt is already armed**. Confirmed by reading the param block (`:51-63`) and the step order around
`Assert-TargetValid` (`:223`).

Its test suite `scripts/pipeline/__tests__/arm-prompt.test.mjs` holds **19 tests**, run by a
dedicated Windows CI job that asserts `pass >= 8`.

Two exclusions the check must honour, both measured:
- `rev-<n>-ready.md` are review jobs, not prompts (DOCTRINE §9.5, verbatim). Two were armed on
  2026-09-06 while the real armed-prompt count was zero — counting them would refuse valid arms.
- `processed/`, `failed/`, `blocked/`, `no-pr-opened/` and `needs-marco/` are full of `*-ready.md`.
  A recursive count would refuse every arm forever.

Merge routing, measured twice this session minutes apart: `pr-deps-s1` → #1680 and `pr-jobroles-s1`
→ #1700, both `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: …"}`.

## WHAT CHANGED

Nothing in the repository. Staged for Marco: `pr-armguard-s1-…-HOLD.md` (**ADMIT, size 2**),
`docs/plans/arming-throughput-brief.md` (status: awaiting Marco's ruling), and this breadcrumb.

## FINDINGS

1. **RULE 4 solves collision, not throughput, and has been credited with both.** Arming one at a
   time protects a single shared working tree. It does nothing for the constraint that actually
   governs delivery — unmerged PRs waiting on one person — because five prompts armed serially still
   produce five PRs that stop at the same gate. **ACTIONED** — separated explicitly in the brief as
   Rule A and Rule B, so the guard is not mistaken for a throughput control.

2. **The guard must exclude `rev-*` and subdirectories or it refuses everything.** The naive
   implementation — count `*-ready.md` — would have refused every arm on 2026-09-06, when two review
   jobs sat armed and no prompt did. **ACTIONED** — both exclusions are stated in the prompt as
   load-bearing, with a regression test demanded for each.

3. **A waiver with no trace is the same blindness moved.** `-Force` must record in
   `.arming-log.txt` that it was forced and what it was forced past. **ACTIONED** — required by the
   prompt.

4. **The throughput question cannot be answered yet, and the brief says so rather than guessing.**
   Merge latency, the share of work that is Marco-gated, and the CI cost of repeatedly rebasing a
   deep queue are all unmeasured. An attempted count of merge results timed out at 120s and was
   abandoned rather than reported partially. **DEFERRED** — the brief names the three measurements
   that would make gating decidable and recommends reporting, not gating, until they exist.

## WHAT I DID NOT DO

- I did not arm either staged item, and I did not merge anything.
- I did not edit `DOCTRINE.md` or any station contract. Changing governance text and tool behaviour
  in one PR makes both harder to review; the doc line is a separate slice.
- I did not implement the guard — only the prompt for it.
- I did not propose a threshold for Marco-gated PRs. Gating on a number nobody has measured is how a
  guard becomes something people route around.
- I did not retry the timed-out grep in a narrower form and present it as the full picture.
