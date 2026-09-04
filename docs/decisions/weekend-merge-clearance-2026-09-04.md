# RULE 2 cleared for the estimating, calculation and CRM work — 5-7 September 2026

**Granted by Marco, in chat, 2026-09-04.** Recorded here rather than left in a transcript,
because on the morning of 2026-09-04 Station 00 spent an entire run reconstructing whether the
merge of #1567 was a RULE 2 violation, and could only clear it by reading a chat transcript to
find that Marco had been present and directing. That cost should not recur.

## What was asked, and what was granted

Marco asked for a station to take over Station 00's driving role for the weekend: arm every
prompt that is slice-0 or has its gates open, drive each to green, and merge. Presented with
three options for the twelve `escalates: true` prompts — hold them all for him, clear them all,
or clear a named subset — **he chose to clear them all.**

> **All PRs arising from the estimating, calculation and CRM prompts may be merged by the
> driving station without a further human decision, 2026-09-05 to 2026-09-07, INCLUDING
> those whose prompt carries `escalates: true`.**

This is the clearance RULE 2 requires. It is not a change to RULE 2 and not a change to
DOCTRINE. It is one dated, scoped grant.

## Scope — exactly these clusters

`scope-card-corrections` · `scope-card-api` · `scope-card-persistence` ·
`charge-steps-correctness` · `line-fields` · `rates-parity-gate` · `scope-card-navigation` ·
`crm-accounts-list` · `crm-register` · `crm-account-360` · `crm-relationships` ·
`crm-comms` · `crm-chrome`

Plus the four session PRs already open: #1591 (merged), #1592, #1593, #1594.

## What is NOT cleared, and stays exactly as it was

- **The never-arm list.** `pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill`, and prod-data
  MT-3/MT-5 are untouched by this and remain Marco's alone.
- **Any prompt carrying a human gate** (`DO NOT ARM`, `Arm ONLY`, `watcher: do-not-arm`). The
  gate is a per-prompt instruction from a human and outranks a blanket clearance.
- **Anything outside the thirteen clusters above.** A PR from another cluster that happens to be
  open this weekend is not covered.
- **`/sot/`.** Station 05's, unchanged.
- **Decision 2's parity gate.** `pr-rateparity-s1` builds the harness; it does not switch charge
  steps on as the price, and this clearance does not authorise that switch. See
  `docs/decisions/estimating-four-decisions-2026-09-04.md`.

## Expiry

**This lapses at the end of 2026-09-07.** After that, `escalates: true` means what it has always
meant and every such merge waits for Marco again. A station reading this after that date should
treat it as history, not as authority.

## Two supervisors, deliberately

The scheduled Station 00 continues to run on its own cadence throughout; its schedule is not
reachable from the driving lane. Both are live on the board at once, which is the condition
DOCTRINE §10.2 warns about and which Station 00 itself flagged in its 12:09 run
("a second actor was live on the board").

What makes it auditable rather than invisible is **arm attribution**: with `-Actor` mandatory,
every line in `.arming-log.txt` names the session that armed it — `station-00` or
`station-06-cloud`. `arm-prompt.ps1`'s lock already serialises the arming itself, and RULE 4
(one armed at a time) is unchanged.

**Neither station should raise a RULE 2 escalation about the other's merges inside this scope
and these dates.** Point at this file instead.

---

# AMENDMENT — 2026-09-04, later the same evening

**Marco, in chat:** *"I'm handing the board back to you, your goal is to open as many prs
possible from the pipeline, and drive the entire board to green and to merge, including prs
that the other station 00 opens or the watcher opens."*

## What this widens

The clearance above was scoped to thirteen clusters and explicitly excluded Station 00's own
board PRs. That exclusion is **lifted**. The driving station may now drive and merge **every**
open PR on the board, including:

- Station 00's board-collection PRs (`docs(board): 00 collect ...`)
- PRs the watcher opens from consumed prompts
- Doctrine and pipeline PRs from any station

Same dates. **Still expires at the end of 2026-09-07.**

## What it does NOT widen — unchanged, and not inferred away

- **`/sot/` remains Station 05's.** Marco did not mention it and a widening of *whose PRs* is
  not a widening of *which files*. CP-24 hard-blocks `sot/` mixed with code in CI regardless.
- **The never-arm list stands**: `pr-fv2-formrule-contract`, `pr-siteid-notnull-backfill`,
  prod-data MT-3/MT-5.
- **A prompt carrying its own human gate stands.** `DO NOT ARM`, `Arm ONLY`,
  `watcher: do-not-arm` are per-prompt instructions from a human and outrank a blanket
  clearance. A blanket permission is not a licence to ignore a specific refusal.
- **A PR whose checks have not concluded is never merged.** Auto-merge is how a green PR lands
  unattended; it is not a way to land an unfinished one.

## Standing practice adopted this evening: auto-merge on open

Every PR in scope gets `gh pr merge <N> --auto --squash --delete-branch` **as soon as it
opens**, not once it is green.

The reason is measured. At 20:30Z all four open PRs — #1589, #1593, #1594, #1606 — were green
on every check except `tendering-e2e`, which had been running 8-9 minutes on all four at once.
Nothing was wrong; e2e is simply the long pole. Without auto-merge every one of them waits for
a human or a driving session to notice it went green, which on a weekend can be hours after the
fact. With it, the board drains itself and the only thing that still needs a driver is **arming
the next prompt** — because that is the one step no CI job can do.

This is what makes the weekend goal reachable at all. The throughput ceiling is RULE 4 plus the
e2e cycle, not attention.

## The reporting obligation is unchanged

A driving station still reports what it merged and why it was eligible. Auto-merge does not make
a merge unattributed: the PR carries who enabled it and when.

