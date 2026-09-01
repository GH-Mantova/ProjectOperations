# Station 06 — PR Master | 2026-09-01T05:25Z–05:40Z

## GROUND

```
UTC            2026-09-01T05:25:30Z
origin/main    b30e166a
dev tree       main @ b30e166a  C:\ProjectOperations2
doc version    1
bootstrap      n/a - invoked interactively by Marco, not by a scheduled task
```

Station doc read from `git show origin/main:docs/pipeline/stations/06-pr-master.md`;
`git diff --quiet origin/main -- docs/pipeline/stations/06-pr-master.md` exited 0, so the working
copy is not stale for this file. [MEASURED]

## WHAT I MEASURED

**Sweep verdict.** `scripts/pipeline/status-sweep.ps1`, 05:25:40Z:
`DO NOT ACT: a board mutation is in progress (section 3 -- in-progress prompt / git lock / git
process). Wait, re-run, then act.` No board mutation was made this run. [MEASURED]

**The station doc forbids what this station has been doing.** `06-pr-master.md` on origin/main,
AUTHORITY: *"You design and STAGE. You never arm and you never merge... The `git mv` to `-ready` is
Station 00's alone."* Phase 6.4: *"NEVER merge anything - the supervisor/auto-merge drives the
board."* [MEASURED]

**What this station actually did, 2026-08-31 to 2026-09-01.** From
`docs/pr-prompts/.arming-log.txt` and the merge history: [MEASURED]

- ARMED, via `arm-prompt.ps1` (never a bare `git mv`; the lock was taken and the index released
  each time): `pr-scopesub-s1`, `pr-scopesub-s2`, `pr-estpricing-s3`, `pr-estpricing-s4`,
  `pr-scopesub-s3`, `pr-scopesub-s4`, `pr-cardui-s1`, `pr-cardui-s2`.
- MERGED: `#1439`, `#1470`, `#1472`.
- Also opened `#1477` and pushed fixes onto three agent branches (`#1443`, `#1471`, `#1473`).

Every one was on Marco's explicit instruction, in chat, at the time. None was autonomous. That does
not make it compliant with this doc.

**A grant recorded on main that is now wrong.** `#1472` landed
`00-06-pr-master-2026-09-01-0320-marco-authorised-automerge-for-one-cluster.md`, recording Marco's
authorisation for Station 06 to arm auto-merge on the seven `pr-cardui-*` slices. That breadcrumb is
accurate as history and misleading as instruction: as of this run Station 06 does not merge at all.
[MEASURED — the file is on origin/main]

## WHAT CHANGED

**Nothing on the board.** No prompt armed, no PR merged, no PR opened, no branch pushed, nothing in
`C:\po-watcher\**` touched. One untracked breadcrumb written to the dev tree — this file.

## FINDINGS

### F1 — Station 06 armed and merged for two days; Marco has ruled that it stops

Put to Marco directly, with three options in RULE 1 order (amend the doc and keep driving / revert
to the doc / carry on undocumented). **He chose to revert to the doc.** From this run:

- Station 06 arms nothing. Everything it produces lands `-HOLD`. The `-ready` rename is Station
  00's alone.
- Station 06 merges nothing. Merges are Marco's, or auto-merge.

The eight arms and three merges above are disclosed here so that Station 00 reads them as a known,
closed episode rather than discovering them as drift.

**DISPOSITION: ACTIONED** — behaviour changed this run; verified by making no board mutation while
holding a DO-NOT-ACT verdict, with two armable slices sitting in front of me.

### F2 — The auto-merge grant in `#1472` is superseded and should not be acted on

It says Station 06 may arm auto-merge on `pr-cardui-*` PRs and asks Station 00 not to disarm it.
**Both halves are dead.** Station 06 no longer merges, so it will not arm auto-merge on anything.

**Station 00: treat `autoMerge=ENABLED` on any PR as unexplained again, including `pr-cardui-*`.**
The exception `#1472` asked for is withdrawn by the station that asked for it. Marco may still arm
auto-merge himself — he did so on `#1473` — and that is his to do, not a grant to an agent.

**DISPOSITION: ACTIONED** — withdrawn here, at the same tracked path the grant was made.

### F3 — Two prompts are armed and in flight, armed before the ruling

`pr-scopesub-s4-linked-items-and-quotes` (armed 03:18Z) and `pr-cardui-s2-wbs-table-shell` (armed
04:38Z) are `-ready` in the dev tree. **They should be left to run.** Un-arming a prompt the watcher
may already own is the duplicate-PR hazard the 2026-09-01 restart freeze was written to avoid, and
undoing them would be a board mutation under a DO-NOT-ACT verdict.

Arming of everything after them is Station 00's: `pr-cardui-s3-manpower-columns` through
`pr-cardui-s7-cutting-section`, each gated on the previous slice's token, then
`pr-scopesub-s5-sub-tab-ui` on `SCOPE_CUTTING_V1` + `SUB_LINE_PRICES_LINKED_ITEM`. The chain is
wired so a gate, not a memory, decides when each becomes armable.

**DISPOSITION: DISPATCHED** — to Station 00, which owns arming from here.

### F4 — `#1477` is open and has no merger

`test(export): one makeSummary() helper` — opened by Station 06 at ~04:45Z, before the ruling. It
collapses the hand-built `ExportPayload["summary"]` literal that has broken three times (SUB in
`#1443`, the provisional split in `#1471`) into one annotated helper.

It also records a defect worth keeping: `estimate-export.service.spec.ts` built its own summary with
**no type annotation**, so on main today it is still missing `provisionalSubtotal`,
`provisionalWithMarkup` and `provisionalTotal` — and the suite is green. That fake has been feeding
those tests a shape production does not produce. [MEASURED — `git show origin/main:` on that file]

Station 06 will not merge it. It needs Marco or auto-merge.

**DISPOSITION: ESCALATED** — Marco: merge `#1477`, or tell me to close it and let the fixture keep
breaking once per field. There is no third option that leaves the spec type-checked.

### F5 - Marco overrode F1 once, deliberately, for `pr-gates-approval-receipt`

At 09:07Z Marco instructed Station 06 to arm `pr-gates-approval-receipt`. That contradicts F1 above,
which he himself ruled 20 minutes earlier, so it was put back to him before acting rather than done
quietly - a rule recorded in a breadcrumb and broken within the hour is worse than no rule. He
confirmed the override in the same exchange. [MEASURED - the arming log line below]

```
2026-09-01T09:07:42Z  ARMED  pr-gates-approval-receipt  escalates=true
lint: ADMIT (size 6)   sweep immediately prior: SAFE TO ACT   index clean after
```

**Scope of the override: this one prompt.** F1 stands for everything else - Station 06 still arms
nothing and merges nothing. The seven `pr-cardui-*` slices, `pr-cardui-s8` and `pr-scopesub-s5`
remain Station 00's to arm. Station 06 merged nothing this run and still has not.

Why this prompt and not another: it is option (A) from the 2026-08-31 attribution escalation, and
withdrawing the auto-merge grant in F2 makes it more load-bearing, not less. It is the change that
turns a merge approval into a reviewable commit at `docs/decisions/merge-approvals/<pr>.md` instead
of a label click nobody can attribute - the hole that has now recurred twice on this board.

**DISPOSITION: ACTIONED** - armed on Marco's explicit confirmation, scope stated, F1 otherwise intact.

## WHAT I DID NOT DO

- **Did not un-arm `pr-cardui-s2` or `pr-scopesub-s4`.** See F3 — the duplicate-PR hazard is worse
  than the inconsistency.
- **Did not merge `#1477`**, though CI was running on it and I had been merging until this run.
- **Did not open a PR for this breadcrumb.** The sweep said DO NOT ACT; the dev tree is a sanctioned
  home and a breadcrumb filename matches no watcher glob, so it arms nothing.
- **Did not amend `06-pr-master.md`.** That was option (a) and Marco chose (b); the doc is right as
  written and this station was wrong.
- **Did not touch `C:\po-watcher\**`,** the watcher process, or any launcher.
