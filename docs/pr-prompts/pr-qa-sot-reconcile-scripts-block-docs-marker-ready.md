---
premise: "grep -q 'notlike .sot/' scripts/pipeline/commit-sot-reconcile.ps1"
premise_means: The doc-reconcile helper scripts still reject EVERY non-sot/ file as a "CP-24 VIOLATION". CP-24 as actually implemented in scripts/pr-gates/pr-gates.mjs permits sot/ + docs/ together and forbids only sot/ + code. The tooling is stricter than the gate it names, so a doc-reconcile PR cannot carry the docs/ marker that discharges its own backlog gate.
premise_means_check: "grep -n 'notlike' scripts/pipeline/commit-sot-reconcile.ps1 scripts/pipeline/rebase-and-open-sot-pr.ps1"
scope:
  - scripts/pipeline/commit-sot-reconcile.ps1
  - scripts/pipeline/rebase-and-open-sot-pr.ps1
done_when: "! grep -q 'notlike .sot/' scripts/pipeline/commit-sot-reconcile.ps1 && ! grep -q 'notlike .sot/' scripts/pipeline/rebase-and-open-sot-pr.ps1 && grep -q 'docs/' scripts/pipeline/commit-sot-reconcile.ps1 && grep -q 'docs/' scripts/pipeline/rebase-and-open-sot-pr.ps1"
size: 2
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: "Two-file, non-destructive PowerShell edit; no schema, no migration, no data. Revert the commit and both scripts return to the sot-only assertion. Nothing persists outside the repo."
---

# doc-reconcile scripts reject the docs/ marker that CP-24 actually allows

## The defect (found by 04-scanner, 2026-08-18, main `d008af68`)

`CP-24` is implemented in `scripts/pr-gates/pr-gates.mjs`. Its own comment and its own code
say docs/ is allowed to ride with sot/:

```js
// docs/** is intentionally NOT in codeFiles: doc-reconcile PRs legitimately
// touch sot/ + docs/ (runbooks, pr-prompts, review artifacts).
const sotRe  = /^sot\//;
const codeRe = /^(?:apps\/|scripts\/|\.github\/|packages\/|package\.json$|pnpm-lock\.yaml$)/;
```

A PR containing `sot/**` + `docs/**` and no code files hits the second branch and reports
**PASS — "sot-only change (doc-reconcile PR)"**.

The two sanctioned helper scripts enforce a **different, stricter** rule and attribute it to
CP-24 by name:

- `scripts/pipeline/commit-sot-reconcile.ps1:43-52`
  ```powershell
  $bad = @($staged | Where-Object { $_ -notlike "sot/*" })
  if ($bad.Count -gt 0) { Write-Output "  CP-24 VIOLATION - non-sot files staged:" ; ... ; exit 1 }
  ```
- `scripts/pipeline/rebase-and-open-sot-pr.ps1:30-35`
  ```powershell
  $bad = @($files | Where-Object { $_ -notlike "sot/*" })
  if ($bad.Count -gt 0) { Write-Output "  CP-24 VIOLATION. Aborting."; exit 1 }
  ```

Both `git reset` / abort on any `docs/**` path and print `CP-24 VIOLATION` for a combination
CP-24 explicitly permits. The message is wrong as well as the behaviour: it tells the operator
the gate rejected them when the gate would have passed them.

### Why this is not cosmetic

The BACKLOG item `settings-restructure-sot-nav-reconcile` (P2, gate currently RELEASED) is
discharged by writing `docs/audits/settings-restructure-sot-reconcile.md` **in the same PR** as
the `sot/01` §9 edit. Run through the sanctioned tooling that PR cannot be built at all — the
marker is staged, the script calls it a CP-24 violation and resets. The item has now been
reported as "released but blocked" across three separate scanner runs on the strength of a
constraint that only exists in the helper, not in the gate.

Blast radius: every doc-reconcile PR that needs to land a marker, runbook, review artifact or
`docs/pr-prompts/**` file alongside its sot/ edit — i.e. the discharge path for every gated
backlog item of this shape.

## What to change

In **both** scripts, replace the `-notlike "sot/*"` inversion with the same rule `pr-gates.mjs`
applies, so the helper and the gate cannot disagree:

1. A staged/changed file is **forbidden** only if it matches the code prefixes CP-24 forbids:
   `apps/`, `scripts/`, `.github/`, `packages/`, `package.json`, `pnpm-lock.yaml`.
2. `sot/**` and `docs/**` are both **allowed**.
3. Keep the hard abort (`git reset` + `git switch main` in `commit-sot-reconcile.ps1`; `exit 1`
   in `rebase-and-open-sot-pr.ps1`) for a genuine violation — only the predicate changes.
4. Correct the operator-facing text: the failure is "sot/ mixed with CODE", not "non-sot files
   staged". State which files tripped it, as now.
5. Keep the existing "nothing staged" abort in `commit-sot-reconcile.ps1` unchanged.

Do **not** change `scripts/pr-gates/pr-gates.mjs`. The gate is correct; the helpers are wrong.
Do **not** touch `sot/**` in this PR — it edits `scripts/**`, so CP-24 would hard-fail it.

## Verification

- `grep -n "notlike" scripts/pipeline/commit-sot-reconcile.ps1 scripts/pipeline/rebase-and-open-sot-pr.ps1`
  returns no `sot/`-inverting filter.
- Positive control (prove the check can still say NO): with a fake staged `apps/x.ts` the script
  must still abort. Paste both outcomes into the PR body — a predicate that only ever passes is
  not a predicate.
- Negative control: a staged `sot/01-charter-and-architecture.md` + `docs/audits/x.md` pair is
  accepted and committed.

## Guards this will trip

`scripts/**` only. CP-24 PASSes (no `sot/` files changed). No migrations (CP-11/CP-23 clean),
no permission codes, no schema, no data-model map change. `gate_allow: none` is correct.

---

STANDING AUTHORITY: you have standing authority to finish the work, commit, push, and OPEN THE
PR. Do not ask. An agent that finishes the work and then asks permission has failed.
