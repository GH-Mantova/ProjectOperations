---
premise: '! test -f docs/plans/merge-liberty-and-speed-plan.md'
premise_means: No plan exists yet for widening autonomous merge authority to "merge anything but hard-stops" and improving smoke/merge speed; the pipeline still gates the whole escalating class on Marco and runs strict-serial main at ~1 merge/CI-cycle.
scope:
  - docs/plans/**
done_when: pnpm build && pnpm lint && test -f docs/plans/merge-liberty-and-speed-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: true
---

# SLICE-0 plan: widen autonomous merge authority + speed up smoke & merge

Author `docs/plans/merge-liberty-and-speed-plan.md` — a binding SLICE-0 plan (house style of
`docs/plans/settings-restructure-plan.md`: grounded audit → ordered, independently shippable slices
≤ ~10 files each, `requires_merged` edges, rollback notes). This slice writes the PLAN ONLY. No
code, no `/sot/`.

Marco's decision (2026-08-02): **give the watcher/supervisor more liberty to merge, and make the
smoke-test + merge cycle quicker.** Specifically: (A) the automation may merge ANY PR that is not a
hard-stop, on green — dropping the blanket "escalating class waits for Marco" gate; (B) improve (not
necessarily eliminate) the three slow spots: strict-serial main, smoke/e2e duration, and watcher
throughput.

## Ground first (read, cite file:line in the plan)
- `scripts/pipeline/pipeline-lib.ps1` — `Assert-SmokedOrEscalate`, `Merge-Pr`, `$script:NEVER_MERGE`
  (and its per-entry reason + discharge condition), `Assert-Mergeable`.
- `scripts/pipeline/queue-sync.ps1` — how it counts/handles `escalating(do-not-merge)` and arms prompts.
- `scripts/pr-watcher/**` — the watcher merge path, one-at-a-time processing, `queuePaused` behaviour.
- `docs/pipeline/DOCTRINE.md` — the binding merge rules ("exactly one way to merge", the hard stops).
- `docs/pr-prompts/PROMPT-SCHEMA.md` — current `escalates` semantics (gates MERGE not RUN;
  `needs-marco/` is the only real stop).
- `.github/workflows/playwright.yml` + `playwright.config.ts` — current e2e shape (serial, chromium
  only for pr-acceptance) — the smoke/e2e speed surface.
- `sot/05-decisions-and-lessons.md` — LL-38 (supervisor doing station work killed the queue),
  the #552 prod-data near-miss, #476/#478 over-claim merges, the incident ledger.

## The plan must cover

### A. Merge liberty — "merge anything but hard-stops"
- Define the merge policy crisply: auto-merge on green for ALL PRs EXCEPT the enumerated hard-stops.
- **Enumerate the hard-stops that STILL require Marco / never auto-merge** (these are absolute and
  non-negotiable — the plan keeps them): the `NEVER_MERGE` list (prod-data class, #552); any
  Azure/Entra/SharePoint mutation; production auth / secrets / deploy config; anything needing a real
  human identity (#538). These route to `needs-marco/` and never auto-merge.
- **Tighten `escalates: true`** so it means ONLY the hard-stop classes above — today it is overloaded
  and is what parks the whole escalating class on Marco. Specify the exact semantics change and every
  call-site/marker that must change (`queue-sync.ps1`, watcher, DOCTRINE, PROMPT-SCHEMA).
- **Compensating controls (mandatory).** Human oversight goes down, so automated verification must go
  up proportionally. The plan must show how each is strengthened/proven trustworthy BEFORE liberty
  widens: `Assert-SmokedOrEscalate`'s diff-matches-claim (`MustContain`), smoke/`smoke-pr.ps1`
  reliability + positive controls ("your instrument lies"), and `NEVER_MERGE` enforcement at the
  point of action (not in a selection filter — the #552 lesson). If a gate cannot be trusted to
  replace the human, the plan says so and keeps the human on that path.

### B. Speed (improve, not necessarily remove)
- **Strict-serial main (~1 merge/CI-cycle):** evaluate a GitHub merge queue and/or parallel smoke
  validation to raise throughput while keeping main green; state the trade-offs, don't just assert one.
- **Smoke/e2e duration:** measure the current baseline first, then propose concrete wins — shard e2e
  across runners, cache Playwright browsers/deps, trim/parallelise. Quantify expected savings.
- **Watcher throughput:** propose safe concurrency (validate/merge more than one at a time) WITHOUT
  reintroducing the collision the supervisor exists to prevent (LL-38) or the `queuePaused`
  unrecoverable-freeze failure mode.

### C. Governance
- The decision itself (Marco's ruling to widen merge liberty) is source-of-truth: the plan schedules
  a DEDICATED `sot/05` decision/ADR entry landed via a doc-reconcile slice — never mixed with code.

### D. Slice list + risks
- Ordered, independently shippable slices (each ≤ ~10 files, `requires_merged` edges, rollback notes).
- A risks section that names the incidents wider liberty could reopen (#476/#478 over-claim,
  #552 prod-data, LL-38) and how each slice's compensating control prevents recurrence.

## Do NOT
- Do NOT write any pipeline/code changes in this slice — output is the plan document only
  (`scope` is `docs/plans/**`).
- Do NOT weaken, remove, or narrow any hard-stop (NEVER_MERGE, Azure/Entra/SharePoint, prod-auth,
  real-human-identity). Liberty is about the NON-hard-stop path only.
- Do NOT edit `/sot/` here — the decision lands via its own doc-reconcile slice.
- Do NOT propose anything requiring an Azure/App-Service/Entra change to operate.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f docs/plans/merge-liberty-and-speed-plan.md`

## Merge gate (escalates: true)
This plan redefines the pipeline's safety posture — Marco reviews the authored plan before it lands.
Open the PR and LEAVE IT UNMERGED; note in the PR body it must carry `do-not-merge` for Marco.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — if the plan already exists on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any failure.
