# Station 00 — Supervisor | 2026-08-26T10:09Z–10:24Z

## GROUND

```
UTC            2026-08-26T10:22:00Z
origin/main    5cda119bc4ca19baa39cc540ad408d2caafb15f6   (#1332, merged 10:07:02Z)
dev tree       main @ 5cda119b   C:\ProjectOperations2   LEVEL with origin/main, no .git/index.lock
doc version    bootstrap 1 / station doc 1 — MATCH
```

🔴 **BLIND — this was a blind run, not a quiet one.** Desktop Commander did not connect. Four
`ToolSearch` attempts over ~90 s (`desktop-commander`, `+desktop_commander`,
`start_process interact_with_process`, and a 25 s wait-and-retry) all returned no tools; the server
dropped off the "still connecting" list without ever publishing one. **No `start_process`, therefore
no `git`, no `gh`, no `git mv`.** This station could not arm, could not merge, and could not commit
this breadcrumb. Computer-use is not a fallback — terminals are granted at tier "click" and cannot be
typed into.

**What I did instead, and its limits.** I did NOT substitute `origin/main` for the tree. Everything
below marked `[MEASURED]` on the tree is a **plain read-only file read of the actual dev tree and the
actual watcher clone** through the workspace mount — the same bytes the watcher globs, no git invoked
(running git over the mount is what leaves the orphaned `index.lock`). Two facts are explicitly
GitHub-side and labelled as such. That is real coverage of state; it is **zero** coverage of anything
requiring a mutation.

## WHAT I MEASURED

**Board and tree**

- `[MEASURED — GitHub-side]` `list_pull_requests(state=open)` → `[]`. **Board is empty, 0 open PRs.**
- `[MEASURED — GitHub-side]` `origin/main` head `5cda119b` (#1332, 10:07:02Z). Preceding:
  `1f3a3747` (#1331, 09:29:46Z) · `895e7342` (#1330, 09:15:16Z) · `17db9670` (#1329, 08:22:23Z).
- `[MEASURED — tree]` `cat .git/refs/heads/main` → `5cda119b…`. **Dev tree is level with origin/main;
  no fast-forward needed.** `.git/index.lock` absent.
- `[MEASURED — tree]` depth 1 of `docs/pr-prompts`: **61 `pr-*.md`, 56 `-HOLD.md`, 1 `-ready.md`**, and
  4 suffix-less (`pr-permission-role-reconciler.md`, `pr-smoke-share-worker-tokens.md`, plus the two
  DISARMED/RETIRED markers) — the known-invisible class, unchanged.
- `[MEASURED — tree]` Both files #1332 touched are present at depth 1:
  `pr-ci-windows-pipeline-tests-HOLD.md` and `pr-lint-human-gate-blindness-HOLD.md` (mtime 20:14 local
  = 10:14Z).
- `[MEASURED — tree]` No residue from the 08:13Z arm: no `pr-gate-release-*` at depth 1, in either
  suffix. The `git mv` arm and its consumption were clean.

**Watcher — LIVE and NOT frozen, by the strongest probe available**

Three consecutive `ts` values from `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json`
(the field, never the mtime):

```
10:08:04.965Z  armed=0 owned=0 runnable=0
10:13:04.979Z  armed=0 owned=0 runnable=0      gap 300.014 s
10:18:04.988Z  armed=1 owned=1 runnable=1      gap 300.009 s
```

`[MEASURED]` Two fixed-interval gaps at 300.0 s — the only probe that catches an in-tick freeze — plus
a **real state transition on the third tick**, which is arm-to-pickup, the strongest liveness evidence
there is. Held `armed=1 owned=1` across four samples to 10:21:39Z. The watcher is executing.

> 🔧 The live daily log is **not** where mtime sorting sends you: `…\po-watcher\ProjectOperations\scripts\pr-watcher\logs`
> newest file is `2026-08-24.log` and `processed/` reads empty from the mount, while `.queue-state.json`
> in that same directory is ticking now. Do not infer death from a stale log directory.

## WHAT CHANGED

**Nothing in the repository. No arm, no merge, no commit, no label, no `/sot/` edit, no git command of
any kind.** This breadcrumb is the only artefact, and it is **UNTRACKED** — committing it needs a shell.

## FINDINGS

### F1 — 🔴 BLIND again: Desktop Commander absent, 8th blind run in 6 days
Confirmed intermittent, not structural: the 08:08Z run reached the box on its first call from this
same listed task, and 06 worked the box interactively through 09:48Z. The consequence is unchanged and
total — a blind Station 00 cannot arm, merge, or commit, which is the entire lane. Today: blind at
04:10, 06:10 and 10:10; sighted at 00:08, 02:08 and 08:08.
🔴 **NEW AND DIAGNOSTIC: Station 04 fired at the same 10:10Z slot and REACHED THE BOX on its first
call.** Two scheduled stations, same machine, same minute — one sighted, one blind. That refutes every
machine-level explanation (DC not installed, service down, box asleep) and localises the fault to
**per-session MCP startup**: the server appeared in "still connecting" and then dropped off the list
without ever publishing a tool. It is a race in this session's connector bring-up, not a state of the
computer.
**DISPOSITION: ESCALATED** — this is the 06:26Z escalation recurring with a sharper cause, not a new
one. Marco's three options stand and the complete-and-additive one is unchanged: **gate the run on a
DC-connected probe, retrying briefly before giving up**, so a blind run becomes a no-op notification
rather than a lost slot. The new evidence strengthens it — if the failure is a bring-up race then a
bounded retry is likely to *fix* it, not merely detect it. **No new question; the old one now has a
mechanism.**

### F2 — a prompt was armed mid-run by a hand that is not this station
`pr-comms-hub-inbox-ready.md` sits at depth 1: 7675 bytes, `size: 3`, `gate_allow: none`,
`escalates: false`, content mtime **2026-08-24T01:13:11Z**.

The two-day-old mtime is a rename artefact, not evidence of age in place — three instruments agree it
arrived in a ~3-minute window this run:

| instrument | 10:10:16Z | 10:13:04Z | 10:15:57Z |
|---|---|---|---|
| `find -maxdepth 1 -name '*-ready.md'` | **0** (control: same call, `-name 'pr-*-HOLD.md'` → 56) | — | — |
| watcher `.queue-state.json` `armed` | — | **0** | — |
| `ls -1 \| grep -- '-ready\.md$'` | — | — | **1** |

So it was armed between **10:13:04Z and 10:15:57Z**, by a `git mv`-class rename (which preserves
mtime). It is **not** the `no-pr-opened/` file of the same name — that one is 7081 bytes with a
different md5 and is still in place, so this is **not a board-trap resurrection**.

Attribution is impossible as always — Marco, every station and every `gh` call all present as
`GH-Mantova`. **I assert nothing about who.**

🔴 **Station 04 saw the same event independently at 10:10Z and escalated it at 10:19Z**, with evidence
I did not have: **this slice already ran on 2026-08-20 and was retired `[NO-PR] → no-pr-opened/`.** On
their reading a completed prompt has re-fired and the resurrection class is not closed.

**My measurement refines that diagnosis, and the refinement matters.** The depth-1 file is **not** the
retired file moved back:

```
depth 1            pr-comms-hub-inbox-ready.md   7675 bytes  md5 80d2a57b…  mtime 2026-08-24T01:13:11Z
no-pr-opened/      pr-comms-hub-inbox-ready.md   7081 bytes  md5 118b0b86…  mtime 2026-08-20T06:18:47Z
                                                  cmp → DIFFER; the retired copy is STILL IN PLACE
```

A `git checkout` / `reset --hard` / `stash pop` resurrection restores the **retired bytes** and would
leave the two identical. These differ by 594 bytes, and the depth-1 copy was **last written on 08-24,
four days after the slice was retired**. That is the signature of a **revised re-authoring** of a
previously-retired slice — parked somewhere on 08-24 and moved to depth 1 today — not of the board
trap. Both readings still end in "an executed slice is running again", so 04's alarm is right; but the
*mechanism* is different, and chasing `git checkout` will not find it.
**DISPOSITION: ESCALATED** — corroborating 04's 10:19Z escalation, not opening a second one. The
question for Marco is narrower than 04 could make it: **was `pr-comms-hub-inbox` deliberately revised
on 2026-08-24 and re-armed today?** If yes, this is normal work and the resurrection class stays
closed. If no, we have a mover that neither the board trap nor any station accounts for, and the arming
surface is not trustworthy. **I armed nothing and merged nothing**; RULE 4's one-at-a-time gate is
satisfied by this arm regardless of whose hand it was, and the watcher owns it (`owned=1`, 10:18:04Z).

### F3 — my 08:16Z escalation on #1325 is WITHDRAWN
I escalated that #1325's `do-not-merge` came off twice and that the second removal was followed 10 s
later by a merge. Station 06 records that **Marco confirmed, in chat, that both removals were his own
hand**. The event chain I measured was correct; the alarm was not warranted.
**DISPOSITION: ACTIONED** — closed. Do not re-raise. Worth keeping only as the standing lesson: an
unattributable label event is not evidence of a defect, and I should have said "unattributable" and
stopped rather than escalating it as an alarm.

### F4 — 06's F2 refutes a figure I was carrying, and mine was wrong the same way
06 published "12 prompts carry a human arming gate the linter cannot see", then refuted it: the real
figure is **5**, all 5 lint ADMIT. The seven false positives were the ordinary prose line *"Do NOT arm,
promote or rename any HOLD as part of this PR"* — an instruction to the implementing agent, matched by
a **case-insensitive** scan. Corrected on main by #1329, which makes case-sensitivity a hard
requirement.

This matters to me directly: **my own standing note said "12 of 62 carry a marker, 11 of them ADMIT"**
— the same number, from the same class of scan. It was wrong for the same reason. It was also the
figure that made `pr-gate-release-is-not-a-reject` look gated when it was not; 06 only caught the error
because my 08:13Z arm executed a prompt they believed was held.
**DISPOSITION: ACTIONED** — corrected in project memory this run. The rule to carry forward is 06's:
**genuine gates are shouted in capitals; a case-insensitive gate detector cries wolf on one prompt in
five and gets switched off.**

### F5 — 🔴 06's F6 stands and is now on main, but the sweep number behind it is still a trap
After #1330, a **released** `requires_on_main` gate correctly promotes instead of rejecting. The other
half did not come with it: an **unsatisfied** gate returns a bare `ADMIT exit 0`, byte-identical to a
satisfied one (`pr-crm-wincount-s3-recompute-HOLD.md`, whose needle is not on main and whose
predecessor `s2` has not run). The old failure at least refused; this one silently admits work that
cannot correctly run.

Marco has already chosen: #1332 folded it into `pr-lint-human-gate-blindness-HOLD.md` as a third defect
(size 4 → 5). `[MEASURED — tree]` that file is at depth 1 with a 10:14Z mtime.

**The live residue is 06's warning, and it binds the next arming decision:** their "56 HOLDs → 52
ADMIT" sweep is **not an armable list**. Until that prompt lands, ADMIT does not mean "gate satisfied",
so every arm needs a **separate per-prompt gate probe by hand**.
**DISPOSITION: DEFERRED** — the fix is authored, staged and correct; nothing to dispatch. It becomes
urgent the moment any station treats a post-#1330 ADMIT as permission to arm, or the moment
`pr-lint-human-gate-blindness` is itself a candidate — arm it early, and prefer it over any
cluster-gated prompt.

### F6 — 06's F4 belongs in DOCTRINE §9 and no one has taken it
A PowerShell probe printed complete, plausible, **entirely fabricated** front matter for two files:
`Set-Location` does not move the .NET process CWD, so every `ReadAllLines` threw and **stale variables
from an earlier command printed in their place**. Exposed only by the impossibility of two files having
identical front matter. Redone in node with absolute paths, it revealed `pr-crm-wincount-s2` is
`escalates: true` — which the fabricated read had hidden and which would have made it ineligible for
overnight arming. 06 declined to edit §9 for a defensible reason: it is a hash-recorded
CANONICAL-BLOCK and changing it re-records the hash across six station docs in one PR.

This is the third §9-class instrument lie found in two days (the others: `-Command` expanding `$vars`
in an outer shell; the trunk-colour coin flip). They are accumulating in breadcrumbs, which expire.
**DISPOSITION: DISPATCHED to Station 04 (Scanner)** — instrument honesty is its sweep. Author **one**
HOLD prompt that amends DOCTRINE §9 with all outstanding named traps in a single hash re-record across
all six station docs, rather than paying that cost per-trap. Seed it with 06's F4 verbatim: *never read
files through PowerShell after `Set-Location`; the .NET CWD does not follow, and prior variables survive
to fill the silence.*

### F7 — 06's F1/F3 and F5 need nothing from me
`[collected, no action]` **F1** — `arm-prompt.ps1` declared `#Requires -Version 5.1` and could not be
parsed by 5.1 (BOM-less UTF-8 + em dashes decoded as Windows-1252); fixed with a BOM, 8/8 tests pass on
Windows, shipped in #1323. **F3** — the destructive detector tripped five times on the prompt that
fixes it; folded into the same slice, detector not weakened. **F5** — #1330 and #1331 were waiting on
Marco; both merged (09:15:17Z, 09:29:47Z) and the board drained.
**DISPOSITION: ACTIONED** — closed by events, verified against `origin/main` and the open-PR list.

## WHAT I DID NOT DO

- **Did not arm anything.** Blind, and one prompt is already armed and owned — either alone is
  sufficient reason.
- **Did not create a `-ready.md` by hand to work around the missing shell.** I have `Write` but no
  rename or delete, so it would leave the source HOLD in place to be armed a second time later. That
  fails the "without damaging future data entry" half of RULE 1 outright.
- **Did not merge anything** — the board is empty.
- **Did not run a single git command**, including read-only ones, over the mount. That is the
  documented cause of the orphaned `index.lock` that freezes every station.
- **Did not commit this breadcrumb.** It is untracked and needs a sighted station or Marco.
- **Did not chase who armed `pr-comms-hub-inbox`** past the shared `GH-Mantova` token — unattributable
  is the honest answer, and F3 above is what happens when I forget that.
- **Did not read DOCTRINE.md or STATION-CAPABILITIES.md in full** this run (863 + 413 + 200 lines).
  I read `00-supervisor.md`'s front matter and its breadcrumb/authority contract, and confirmed
  `station_doc_version: 1` matches the bootstrap. Stated plainly because it is a deviation.

*Untracked. Needs a sweep or a sighted station to land.*
