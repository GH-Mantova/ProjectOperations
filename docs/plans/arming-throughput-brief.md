# Arming, concurrency and merge throughput — a brief for Marco

**Status:** awaiting Marco's ruling. Nothing in this document is binding, and no slice implements it.
**Author:** station 06, 2026-09-06. **Grounded against `origin/main` = `734ff8c9`.**

## Why this exists

On 2026-09-06 station 06 armed a prompt while station 00's scheduled run already had one in flight,
breaking RULE 4. The narrow fix — make `arm-prompt.ps1` refuse — is staged separately as
`pr-armguard-s1`. Writing it surfaced a larger question that the narrow fix does not touch, and
should not: **RULE 4 may be throttling the wrong stage.**

## Two different rules are hiding under one

RULE 4 is stated as "arm ONE AT A TIME". Pulled apart, it is doing two unrelated jobs.

**Rule A — do not collide.** `C:\ProjectOperations2` is a single working tree with one shared index.
Two runs mutating it at once corrupt each other. This is a real hazard with real history: three
collisions on 2026-08-24 are recorded in `arm-prompt.ps1`'s own header.

**Rule B — do not outrun the merge gate.** The watcher merges a PR automatically only when it
touches nothing outside `tests/` or `docs/`. Everything else stops for Marco. Measured directly this
session, twice, minutes apart:

- `pr-deps-s1` → PR #1680 → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: package.json"}`
- `pr-jobroles-s1` → PR #1700 → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/admin/JobRolesPage.tsx"}`

The board's own standing note states the consequence plainly: *"the board grows monotonically until
Marco merges. Arming faster makes the queue longer, not shorter."* A snapshot at 21:30Z that day:
**4 open PRs, 3 of them BLOCKED.**

## Why the distinction matters

Rule A is about a resource — one working tree. It is correctly enforced at arming time, and
`pr-armguard-s1` makes it mechanical.

Rule B is about a **person's calendar**. Arming one at a time does not protect it: five prompts
armed serially still produce five PRs that all stop at the same gate. Nor does arming slowly help —
the PRs simply arrive later and still wait. **RULE 4 has been carrying the reputation of solving
Rule B while only ever solving Rule A.**

That matters in both directions. It means the board can look disciplined (one armed at a time) while
the thing that actually constrains delivery — unmerged PRs waiting on one person — is unmeasured and
ungated. And it means that when Marco is away, arming more is not reckless so much as **pointless**,
which is a different argument and leads to a different remedy.

## What is NOT known, and should be before deciding

This brief deliberately stops short of proposing a number, because the evidence for one has not been
gathered:

1. **Merge latency.** How long does a Marco-gated PR actually wait, distribution not average? A
   count was attempted and abandoned — a repo-wide grep over the processed logs timed out at 120s,
   and a partial count would be worse than none.
2. **The share of work that is Marco-gated at all.** If most slices touch only `tests/` and `docs/`
   the constraint barely binds; if most touch `apps/`, it binds on nearly everything.
3. **Whether stacked PRs actually cost anything.** They rebase, they re-run CI, they can conflict.
   `PR_WATCHER_AUTO_UPDATE=true` means every BEHIND PR gets rebased and its CI restarted — so a deep
   queue may burn CI minutes repeatedly rather than sitting inert. That is a measurable cost and
   nobody has measured it.

## The options, as they stand

**(a) Do nothing beyond `pr-armguard-s1`.** Rule A becomes mechanical; Rule B stays a matter of
judgement. Cheapest. Honest, provided nobody claims RULE 4 protects throughput.

**(b) Report it, do not gate it.** Add a line to `status-sweep.ps1`: *"N PRs open and Marco-gated,
oldest X hours."* Turns an invisible constraint into a visible one at the moment anyone is deciding
whether to arm. No new failure mode — a report cannot wedge the board.

**(c) Gate on it.** Refuse to arm when more than N PRs are waiting on Marco. Strongest, and the most
likely to be wrong: it would stop useful work for a reason that is really about a calendar, and the
threshold would be guesswork until the measurements above exist.

**Station 06's recommendation: (b), and not (c) yet.** A report costs nothing, cannot wedge
anything, and produces exactly the evidence that would make (c) decidable later. Gating on a number
nobody has measured is how a guard becomes something people route around.

## The question for Marco

1. Is Rule B worth surfacing at all, or is the queue depth something you would rather just carry?
2. If yes — report only (b), or gate (c)?
3. If gate: what is N, and is it "open Marco-gated PRs" or "hours the oldest has waited"? The second
   is harder to compute and much closer to what actually hurts.
