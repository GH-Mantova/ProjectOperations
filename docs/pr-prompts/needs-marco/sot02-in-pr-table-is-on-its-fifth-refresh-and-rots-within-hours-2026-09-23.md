# sot/02 §2's In-PR table cannot be kept true by a daily station — five refreshes, and it rots within hours

**Raised by:** Station 00 (scheduled), 2026-09-23T15:2xZ, collecting Station 05's 14:23Z run.
**True at:** `origin/main` `9bf5ad92` (after `#2124` merged at 15:21:14Z).
**Source finding:** Station 05's F2, breadcrumb
`docs/pr-prompts/00-05-sot-keeper-2026-09-23-1423-sot02-named-five-merged-prs-against-an-empty-board-and-a-raw-nul-byte-hides-one-api-file-from-every-grep.md`.
**05 dispositioned it ACTIONED + ESCALATED → you. There was no artifact asking you, so this is it.**

## The question, in one line

**Should `sot/02-roadmap-and-status.md` §2 become a GENERATED table, or should a CI check fail any
PR whose sot/02 names a PR that is no longer open?**

You do not need to read any further to answer that. Everything below is the evidence.

## What was measured

[MEASURED] by Station 05 at 14:23Z, per-PR via `gh pr view <n> --json number,state,mergedAt` —
never the `merged` field of a list response (DOCTRINE §9.4):

sot/02 §2 read *"In-PR — open right now (5)"* against a snapshot stamped `2026-09-21T14:25Z`, and
named five PRs. All five were MERGED, and the board held **zero** open PRs:

| PR named in sot/02 | state | mergedAt |
|---|---|---|
| #2051 | MERGED | 2026-09-21T20:32:06Z |
| #2049 | MERGED | 2026-09-21T20:12:37Z |
| #2047 | MERGED | 2026-09-21T20:48:55Z |
| #2044 | MERGED | 2026-09-21T19:56:09Z |
| #2042 | MERGED | 2026-09-21T19:29:45Z |

NEGATIVE control `gh pr view 999997` → exit 1. POSITIVE control `gh pr list --state open` → exit 0,
`OPEN_COUNT = 0`. **Five of five rows wrong, and the table was falsified within six hours of being
written.**

## Why this is a question for you and not a chore for a station

**This is the FIFTH consecutive refresh of the same table by the same station.** The previous four
are 2026-09-06, 2026-09-17, 2026-09-21T00:20Z and 2026-09-21T14:25Z. The table's own prose already
records them, and already states the conclusion: *"this table cannot be kept true by a daily
station."*

The 09-21 refresh was wrong **fourteen hours** later. Today's refresh — landed in `#2124` — was
correct when written and will rot on the next merge. Five data points, one shape: a hand-maintained
live-board snapshot inside a daily-reconciled document is stale for most of the interval between
reconciles, and it is stale in the direction that matters, because a reader consulting sot/02 for
*"what is in flight?"* is told about work that shipped days ago.

Station 05 cannot fix it. Both real options are `scripts/` changes, and `sot/` is 05's only lane —
CP-24 hard-blocks a PR mixing `sot/` with `scripts/`, with no escape hatch. So the station that
finds it every day is structurally unable to stop finding it.

## RULE 1 — complete-and-additive first

**(a) Make §2 machine-maintained — a generator, or a CI check that fails when sot/02 names a PR
that is no longer open.** ✅ Solves it immediately **and** in future. ✅ Damages no existing or
future data entry — the roadmap's curated STATUS semantics, priorities and narrative are untouched;
only the live-board rows become machine-maintained. **This is the complete-and-additive option and
it is the one to take.** Cost: one `scripts/` slice plus a CI wiring. Station 00 will stage it as a
prompt the moment you say which of the two forms you want.

**(b) Keep refreshing it daily** (what has happened five times). ✅ Passes the immediate half.
❌ **Fails the future half** — measured to rot in six to fourteen hours, every time. It also spends
one Station 05 run per day on a repair that is stale before the next reader arrives.

**(c) Delete the table and point the reader at `scripts/pipeline/bring-up-to-speed.ps1`.**
✅ Passes the future half. ❌ **Fails the immediate half** — it removes a reader's at-a-glance answer
to *"what's next on the pipeline?"*, which is what §2 exists to give, and it is a judgement about
roadmap semantics, which no station auto-edits.

## What is NOT being asked

- Not asking you to write anything. Station 00 stages the prompt; Station 05 lands the `sot/` half
  if any is needed.
- Not asking you to approve a merge. This is a design choice about one document's §2.
- **If you pick (a), the only thing that needs deciding is the FORM:** a generated table (sot/02
  carries a marked region a generator rewrites, like sot/04 already does) or a CI check (sot/02 stays
  hand-written and a gate fails the PR when a named PR is no longer open). Either answer unblocks
  the staging.

## Falsifying probe — how to tell this is dead

`gh pr list --state open --json number` against the PR numbers named in sot/02 §2. If every named PR
is open, the table is current at that moment; re-run it a day later. If §2 has become a generated
region or a CI gate exists that fails on a non-open PR, this escalation is discharged — move this
file to `docs/pr-prompts/needs-marco/discharged/` with a note naming the PR that did it.
