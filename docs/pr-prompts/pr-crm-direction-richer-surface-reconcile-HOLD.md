---
premise: 'grep -q "transactional facts are read-only roll-ups" docs/plans/crm-module-plan.md'
premise_means: crm-module-plan.md still carries the 2026-08-12 locked rule that tender data in the CRM is a read-only roll-up. Marco reversed that on 2026-08-20. Until the plan says so, every CRM slice designed from it builds the superseded direction.
scope:
  - docs/plans/crm-module-plan.md
  - docs/pr-prompts/BACKLOG-DECISIONS.md
done_when: pnpm lint && grep -q "2026-08-20" docs/plans/crm-module-plan.md && grep -q "richer" docs/pr-prompts/BACKLOG-DECISIONS.md
size: 2
gate_allow: none
seed_only: false
escalates: true
---

# Doc-reconcile: the CRM is now the richer surface (Marco, 2026-08-20)

**DOCUMENT ONLY. No code. This PR unblocks CRM slices; it does not build any.**

## Why this exists

`docs/plans/crm-module-plan.md:51` opens a block headed **"Marco's locked decisions (2026-08-12) —
bake in, do NOT re-litigate"**. Two of its rules make the CRM the *thinner* surface for tender data:

- `:60-62` — *"**Transactional modules own** (and roll UP read-only into the CRM): Tender =
  price/scope/outcome … CRM references + surfaces these; never copies/edits them."*
- `:94-97` — *"**transactional facts are read-only roll-ups in the CRM**."*
- `:90` — the ownership matrix row: `| Tender price / scope / outcome | Tendering (Tender) | read-only roll-up |`

And `docs/architecture/drafts/tender-pipeline-register-plan.md:36` refuses to enrich the register at
all: *"The register does NOT get a bid-status column — its STATUS stays the tender status."*

**On 2026-08-20 Marco reversed this**, in these words:

> *"the CRM page should be much richer than the Tendering."*

Put to him explicitly that this contradicts a decision marked *do NOT re-litigate*, he confirmed it
as a deliberate **change of direction**, not a correction of a misreading.

## The rule this PR is really enforcing

A locked decision that has been superseded but not rewritten is worse than no decision, because it
still reads as authoritative. This is the same failure that produced the defect Marco reported today:
`crm-tendering-nav-remodel-plan.md:29-30` paraphrased an earlier decision, the paraphrase inverted its
meaning, and PR #1122 then deleted a board column **citing a document that said the opposite**.

**Write the change down before anything is built on it.**

## What to write

### 1. `docs/plans/crm-module-plan.md`

**Do not delete the 2026-08-12 block.** Supersede it in place, the way `sot/04` marks superseded
decisions — keep the original text visible with a dated override immediately after it, so the
history stays readable. A reader must be able to see what changed and when.

Add, directly under the `:51` heading:

> **SUPERSEDED IN PART — Marco, 2026-08-20.** Decision 2's ownership matrix stands for *writes*:
> the CRM still never edits a transactional fact. What no longer stands is the implication that the
> CRM is therefore the **thinner** surface. Marco: *"the CRM page should be much richer than the
> Tendering."* The CRM is where a tender's life continues after submission — follow-ups, chasing,
> relationship context — so its tender views may carry more capability than the Tendering register,
> not less. Read-only-on-writes and richer-in-view are not in conflict; the 2026-08-12 wording
> conflated them.

Then correct the two lines that carry the conflation (`:94-97` and the `:90` matrix row) so they say
**"read-only with respect to writes"** rather than implying a reduced view. Leave the write-ownership
rule itself completely intact — the CRM still must not edit price, scope or outcome.

### 2. `docs/pr-prompts/BACKLOG-DECISIONS.md`

Append a new dated section recording the change: what the rule was, what it is now, the date, and
the one-sentence reason. Note that it supersedes part of `crm-module-plan.md` §"locked decisions
(2026-08-12)" and name the line numbers, **re-grepped at the time of writing** — this file has
drifted before.

### 3. Note the connection to the board decision

Record, in the same entry, *why* this direction change is coherent rather than a whim: Marco also
decided on 2026-08-20 that the Tendering Pipeline board ends at **Submitted**, and that
*"once they move to submitted, this is where the CRM part of the estimating kicks off with
intensive follow-ups, etc, until the tender is won or lost by us."* The board is the submission
funnel; everything after submission is the CRM's job. **A surface that owns the longer half of the
lifecycle needing more capability is a consequence of that split, not a contradiction of it.**

## Do NOT

- Do NOT touch `sot/` — this is a `docs/plans` reconcile. Mixing them risks CP-24.
- Do NOT delete or rewrite the 2026-08-12 block. Supersede, annotate, keep it readable.
- Do NOT weaken the write-ownership rule. The CRM still never writes price, scope or outcome.
- Do NOT design or stage any CRM slice here. This PR only makes the record current.
- Do NOT touch `tender-pipeline-register-plan.md:36` (the register/bid-status refusal). That is a
  separate question about one specific column and Marco has not reopened it.

## Guardrails

- One attempt. If the plan already carries a 2026-08-20 supersession, say `NO-OP: <reason>`.
- `pnpm lint` must pass.
- Two files. **`escalates: true`** — this changes a design direction. Open the PR, leave it unmerged
  for Marco.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
