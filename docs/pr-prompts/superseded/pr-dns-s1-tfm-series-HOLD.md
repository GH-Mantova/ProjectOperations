---
premise: '! grep -q "TFM-D3" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts'
premise_means: The tender-tracker-migration decision series still uses bare D<n> tokens, so a production code comment saying "D8" is indistinguishable from Marco's D8 - and the two mean different things, one of them an Azure hard stop.
scope:
  - docs/plans/tender-tracker-migration-plan.md
  - apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts
  - docs/data-model/tender-migration/MIG-1-DONE.md
done_when: pnpm build && pnpm lint && grep -q "TFM-D3" apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts && grep -q "TFM-D8" docs/plans/tender-tracker-migration-plan.md
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: d-namespace
cluster_order: 1
---

# D-namespace S1 - prefix the TFM series (chain head)

**Slice 1 of 5. Marco approved the chain 2026-08-20. Full spec:
`docs/pr-prompts/00-supervisor-2026-08-20-D-NAMESPACE-CHAIN-for-05-and-06.md`.**

Marco's instruction, verbatim, governs the whole design:
> *"option 1, ensure chain-wiring everything so no prs are opened before they should"*
> *"as long as chain-wiring and pr arming - opening - green - merge - main order is preserved throughout"*

This is the **chain head**: no gate, because nothing precedes it. Slices 2-5 each gate on a real
token the previous slice writes.

## Why - MEASURED

`D<n>` currently has **five** meanings. A bare `D3` means three different things, two of them in
production code comments:

- Marco `D3` = Payroll -> Xero export (Building & Construction Award)
- TFM `D3` = the T-number is the idempotency key in `Tender.title`
- EA `D3` = turnaround = days-to-quote (`submittedAt - createdAt`)

🔴 **The sharp one is D8:**
- Marco `D8` = branding on system-generated documents only
- TFM `D8` = *"Copy via the EXISTING Graph seam - no new Graph/MSAL client. `escalates: true` -
  **AZURE environment**."*

**Azure is Marco's absolute hard stop.** An agent resolving the wrong `D8` either loses a constraint
it must obey or invents one that does not exist. That is the risk this chain removes.

Until `D<n>` means one thing, the register Station 05 landed in `sot/05` (#1287) cannot be enforced -
a checker would demand that a spreadsheet cell reference and three unrelated plan-local decision
lists be registered as Marco's decisions.

## What to build

Rename **only the TFM series** to `TFM-D<n>` across the three files in `scope`:

- `docs/plans/tender-tracker-migration-plan.md` - the plan's own decision list.
- `apps/api/src/modules/admin-imports/sharepoint-legacy-copy.service.ts` - the decision comments at
  roughly lines 12-16. **Grep for the tokens; do not trust the line numbers.**
- `docs/data-model/tender-migration/MIG-1-DONE.md`.

At minimum `TFM-D3`, `TFM-D8` and `TFM-D9` must exist afterwards; rename **every** member of the
series you find in those three files, not just those three.

🔴 **KEEP the existing "Decision references (from docs/plans/...)" attribution line.** It is what
tells a reader which series a token belongs to. Prefixing without attribution solves half the
problem.

## Do NOT

- 🔴 **Do NOT touch `docs/pr-prompts/superseded/**`.** That is archived history and is deliberately
  left un-renamed; slice 4's checker excludes it instead. Rewriting history there would be a large,
  pointless diff over dead prompts.
- **Do NOT renumber or rename Marco's register.** `D`-allocation is his. This chain renames only
  **foreign** series. Nothing in `sot/05-decisions-and-lessons.md` is in scope here.
- Do NOT touch the EA series - that is slice 2. Do NOT touch `sot/` at all (CP-24 hard-fails any PR
  mixing code and `sot/`; `pr-gates.mjs:327`).
- Do NOT change schema, seed, migrations, permissions or any runtime path. **This slice edits
  comments, plan prose and table labels only** - if a change would alter behaviour, you have gone
  wrong.
- Do NOT touch Azure/Entra/SharePoint configuration. You are renaming a *comment that mentions*
  Graph; you are not touching Graph.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`. That is a scope
limit, **not** a reason to stop before pushing.

## Guardrails

- One attempt. If `TFM-D3` is already on main, say `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
- ⚠️ Check `git diff --numstat` before pushing. A three-line change showing as 271/257 means a line-
  ending flip, not real work - fix it rather than shipping the churn.
