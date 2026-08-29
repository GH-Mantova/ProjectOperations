---
premise: '! grep -q "D_NAMESPACE_EXCLUSIVE" sot/05-decisions-and-lessons.md'
premise_means: sot/06 still uses bare D<n> for dashboard widget IDs and PR-chain labels, and the sot/05 register does not yet state that D<n> is exclusive to it - so no checker can tell a decision citation from a widget ID.
scope:
  - sot/06-active-specs.md
  - sot/05-decisions-and-lessons.md
done_when: grep -q "D_NAMESPACE_EXCLUSIVE" sot/05-decisions-and-lessons.md && grep -q "W1" sot/06-active-specs.md && ! grep -qE "^\s*-?\s*D[1-5]\b" sot/06-active-specs.md
size: 3
gate_allow: none
seed_only: false
escalates: true
cluster: d-namespace
cluster_order: 3
requires_on_main: apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts :: EA-D3
---

# D-namespace S3 - sot/06 widget IDs to W1..W5, PR-chain labels disambiguated, and the register marker

**Slice 3 of 5. 🔴 STATION 05 LANE - this is the only slice in the chain that touches `/sot/`.**
Full spec: `docs/pr-prompts/00-supervisor-2026-08-20-D-NAMESPACE-CHAIN-for-05-and-06.md`.

**Gate:** slice 2 must be on main - `EA-D3` present in
`apps/api/src/modules/reporting/estimating-analytics-report.definitions.ts`.

## 🔴 CP-24 - the rule that decides how you may ship

**CP-24 hard-fails any PR mixing code and `sot/`, with no escape hatch** (`pr-gates.mjs:327`).
`sot/` **+ `docs/` is ALLOWED**; `sot/` **+ `scripts/` or `apps/` is a HARD BLOCK.**

**This slice is `sot/` ONLY.** Two files, both under `sot/`. If you find yourself wanting to touch
`scripts/` or `apps/`, stop - that is slice 4's lane and mixing them fails CI with no override.

## Why - MEASURED

`sot/06-active-specs.md` holds **20 `D<n>` tokens and NOT ONE is a decision citation.** A prior pass
claimed this file cited Marco's D1-D5; that claim was a misread and is **REFUTED**. The 20 break
down as:

- **6 are dashboard widget IDs** (around lines 1223-1227 - grep, do not trust the numbers)
- **the rest are PR-chain labels** in an A/B/C/D work breakdown

## What to build

### 1. `sot/06-active-specs.md` - two different fixes for two different things

- **Widget IDs -> `W1`..`W5`.** These are genuinely identifiers of widgets and have nothing to do
  with decisions.
- **PR-chain labels -> keep the letters, add the word.** 🔴 **Do NOT renumber the chain.** Make every
  occurrence read **`PR D1`** rather than a bare `D1`. The chain's own ordering is meaningful and
  renumbering it would break references elsewhere; all that is needed is that the token stops
  looking like a decision citation.

### 2. `sot/05-decisions-and-lessons.md` - the marker that gates slice 4

Add **ONE line to the register header** stating that `D<n>` is now exclusive to this register,
carrying the literal token:

```
D_NAMESPACE_EXCLUSIVE
```

🔴 **Attach it to a REAL statement, never a stub.** The line must actually say the thing - something
of the form *"`D<n>` is exclusive to this register (`D_NAMESPACE_EXCLUSIVE`); foreign series carry
their own prefix (`TFM-D<n>`, `EA-D<n>`) and dashboard widgets use `W<n>`."* A bare marker with no
sentence around it is a token pretending to be a decision, which is the exact failure this chain
exists to end.

This marker is **slice 4's proof-of-landing gate**. If it is missing or misspelled the chain stops.

## Do NOT

- **Do NOT touch anything outside `sot/`.** No `scripts/`, no `apps/`, no `docs/pr-prompts/`. CP-24.
- **Do NOT renumber or re-word Marco's decision rows.** `D`-allocation is his. You are adding one
  header line, not editing the register's content.
- Do NOT resolve the **D42 contradiction** here (the register says never merge SLICE 0 gate PRs, but
  the log records #1146/#1149/#1150 as merged). **That is Marco's ruling and a separate slice.**
- Do NOT touch the TFM or EA series - slices 1 and 2 own those, and they are already on main by the
  time this runs.
- Do NOT cite a `QUARANTINED` register row as authority - `QUARANTINED` means recorded but
  explicitly **not** binding. The register is 20 REGISTERED / 35 QUARANTINED.
- Do NOT touch Azure/Entra/SharePoint.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the two `sot/` files. That is a scope limit,
**not** a reason to stop before pushing.

## Guardrails

- One attempt. If `D_NAMESPACE_EXCLUSIVE` is already on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure. **If CI reports CP-24, you have mixed lanes** -
  remove the non-`sot/` file rather than arguing with the gate; it has no escape hatch.
- ⚠️ Check `git diff --numstat` before pushing - CRLF churn shows a small change as a huge one.
- ⚠️ `Get-Content` has reported false mojibake before. **Check the hex** before calling anything
  corrupt.
