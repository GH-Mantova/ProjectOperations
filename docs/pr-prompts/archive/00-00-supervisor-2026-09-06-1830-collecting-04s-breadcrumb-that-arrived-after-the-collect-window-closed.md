# Station 00 — Supervisor | 2026-09-06T18:28Z–2026-09-06T18:50Z (addendum to the 18:08Z run)

## GROUND

```
UTC            2026-09-06T18:28:00Z
origin/main    a7f53458            (after #1728 merged 18:23:30Z)
dev tree       main @ a7f53458     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Same sighted run as the 18:08Z collect; this is its second board PR, not a second run. It exists
because **Station 04 fired 99 seconds after this run started, finished while `#1728` was in CI, and
wrote its breadcrumb into the dev tree at 18:2xZ — after my COLLECT window had already closed.**
Leaving it would have billed the 19:07Z run to discover it, and left 04's sweep-rotation hand-off
uncommitted for another hour, which silently stops the rotation.

## WHAT I MEASURED

**04's breadcrumb, collected.** [MEASURED] `git ls-files --others --exclude-standard --
docs/pr-prompts/00-*.md` after fast-forwarding to `a7f53458` →
`00-04-scanner-2026-09-06-1810-status-sweep-tells-every-run-to-clear-26-of-the-29-open-escalations.md`,
16,479 bytes, untracked. Read in full. Six findings; four of them are addressed to this station.

**Its F3 re-verified independently, not inherited.** [MEASURED] `node
scripts/pipeline/lint-prompt.mjs <file>` on each of the ten HOLD prompts 04 called SPENT → **exit 3
on all ten**, and `git ls-files --error-unmatch <file>` → **exit 0 on all ten** (tracked at depth 1).
POSITIVE control that the instrument can answer otherwise: the same linter on
`pr-sweep-stale-check-retires-live-escalations-HOLD.md` → **`ADMIT (size 1)`, exit 0**. So the ten
exit-3 readings are real SPENT verdicts and not a linter that has stopped working.

**Its F2 re-verified independently.** [MEASURED] `gh pr view <n> --json
number,state,title,headRefName,closedAt,mergedAt` on all five:

```
#1703 CLOSED  feat/verdict-home-resolver           closed 11:04:29Z
#1704 MERGED  fix/verdict-home-resolver            merged 11:41:36Z
#1705 CLOSED  fix/verdict-home-resolver-v1-impl    closed 10:24:07Z   <- the one §9.5 was missing
#1707 CLOSED  feat/verdict-home-resolver-v1        closed 11:04:33Z
#1708 CLOSED  fix/verdict-home-resolver-v1         closed 11:04:35Z
```

All five carry `VERDICT_HOME_RESOLVER_V1` in the title. `#1705` closed **40 minutes before** the
11:04Z batch, which is why a reader who checks that batch never meets it.

**`lint-station.mjs`, before and after the canonical re-record.** [MEASURED] before:
`REJECT: 1 of 8 docs failed`, exit 1 — the expected shape for a DOCTRINE-only edit inside
`instruments v2`, and itself the positive control that the gate is live. After
`--write-canonical` (`instruments v2 11803941d227b6fc`, `station-contract v3 954c7f49160daa71`):
`ADMIT: all 8 docs clean`, exit 0.

**04's F4 is the same finding as my F1 at 18:08Z, reached independently and by a different route.**
It measures the clone at 19 behind and `#1704` absent from the running watcher, and it adds a
detail my run did not have: the clone's own `origin/main` ref points at `188cce05`, which is
`#1704`'s squash commit — so the clone is 4 behind even its own stale ref. Two stations, two
instruments, one answer.

## WHAT CHANGED

One board PR carrying, all under `docs/`:

1. **04's breadcrumb**, committed — it reached nobody while untracked.
2. **`docs/pipeline/sweep-rotation.json`**, committed. 04 advanced it to `instruction-drift`
   (position 4 of 4) and may not commit to the shared tree; the station doc makes committing it
   mine. Uncommitted, the rotation silently stops.
3. **04's staged fix published, not armed** — `pr-sweep-stale-check-retires-live-escalations-HOLD.md`
   committed as a tracked `-HOLD.md`. A `-HOLD` filename matches no watcher glob, so committing it
   cannot start work; leaving it untracked is what makes a prompt invisible to every clone, to CI
   and to every other station.
4. **DOCTRINE §9.5 corrected**: four builds → five, `#1705` added with its close time, "a fifth
   duplicate" → "a SIXTH duplicate", and a falsifying probe attached. Canonical hash re-recorded.
5. **Ten SPENT `-HOLD.md` prompts retired** to `docs/pr-prompts/superseded/` by `git mv`.
6. **Two dispositioned breadcrumbs archived** — the 16:12Z and 17:08Z runs, both fully
   dispositioned and both landed (`#1726`, `#1727`). The current cycle stays in the queue root.

Armed: 0 before, 0 after. Merged: this PR only. No label touched, no clone write, no watcher
process started or killed.

## FINDINGS

### F1 — 04's F1 is real and it is an instrument lie in the safe-to-act tool: ACTIONED as published, DEFERRED as armed

`status-sweep.ps1` §5 printed **126 `[STALE]` lines naming 26 distinct `needs-marco/*.md`** against
29 open escalations, each line reading *"escalation is DEAD, clear it."* Two causes, both pushing
toward retiring a live escalation: CLOSED collapsed into MERGED, and every `#NNNN` in a body read as
the escalation's subject rather than as its evidence. My own 18:10Z capture shows the same 126.

**ACTIONED** — 04's fix is now published on `main` as a tracked `-HOLD.md` at `ADMIT`, which is the
half that was missing: an untracked prompt is invisible to every actor but the tree it sits in.

**DEFERRED — not armed, and the reason is this run's F1.** It touches
`scripts/pipeline/status-sweep.ps1`, so `classifyPolicyFiles` routes it to Marco on the
outside-`tests|docs` clause: arming it grows Marco's queue without moving the board. And it would be
built by a watcher running pre-`#1704` code. **What makes it urgent:** the moment anyone acts on a
`[STALE]` line and clears a live escalation — `#1612`'s, whose branch holds the only copy of that
work, is the one already being pointed at. Until then the standing rule already on file covers it:
never act on a §5 `[STALE]` line without reading the file.

### F2 — DOCTRINE §9.5's duplicate count was one short: ACTIONED

Corrected in this PR with both stations' measurements and a falsifying probe. The number matters
because a later reader uses it to decide whether the kill loop is fully accounted for; four PRs
named against five built is exactly the gap that lets a sixth get armed. **ACTIONED** — verified by
`lint-station.mjs` going `REJECT: 1 of 8` → `ADMIT: all 8 docs clean`.

### F3 — ten SPENT HOLD prompts were still armable: ACTIONED

All ten verified at `lint-prompt.mjs` exit 3 with a passing positive control, all ten tracked, all
ten `git mv`'d to `superseded/`. This is the standing "an armed prompt whose PR does not delete it
stays armable forever" defect, discharged for these ten instances.

🔧 **One of them discharges a standing don't-touch note.**
`pr-vmguard-s2-preflight-installs-guard-HOLD.md` has been carried for days as *"DO NOT ARM — NAMED
FOR MARCO"*, and DOCTRINE §10.6 records it at `ADMIT` as recently as 2026-09-06T08:1xZ. `#1720`
landed the PREFLIGHT guard, so its premise died; it now lints exit 3. **Retiring the file is the
right discharge** — a permanent don't-arm note on a prompt whose work has shipped is a rule that
outlives its own subject, which is the failure §9.5's closing bullet is about.

### F4 — merged-but-undeleted branches are now ZERO, and the prune prompt must still not be armed: DEFERRED

04 measured `git ls-remote --heads origin` (asking the remote, not the local cache, which reads 20
against a truth of 11): 11 heads, three belonging to the open PRs, seven stale — all closed-unmerged
or orphan, none merged-but-undeleted. **The standing note "merged-but-undeleted is ONE, not 22" is
now ZERO; re-measure it, never quote either number.**

**DEFERRED** on arming `pr-hygiene-s1-guarded-branch-prune-HOLD.md`, and the reason is an ordering
constraint, not caution: `feat/crm-account360-v2-s1` holds the only copy of `#1612`'s work, its
escalation is live, and `status-sweep.ps1` §5 is currently telling every reader that escalation is
dead (F1). **A prune armed before F1's fix lands would delete the branch the sweep just told
somebody to stop caring about.** What makes it safe: F1's fix on `main`, or `#1612`'s escalation
resolved. Whichever comes first.

### F5 — 04's F4 independently confirms this run's F1: DISPATCHED

Same dispatch to Station 03, unchanged and now carried by two stations' measurements: preserve the
two untracked review files and the 69 stashes (`stash drop`, never `pop`), fast-forward the clone,
restart in the idle window, and read back `VERDICT_HOME_RESOLVER` in the clone's `index.mjs` as the
proof. Next 03 occurrence `2026-09-06T23:00:45Z`. **DISPATCHED** → Station 03.

### F6 — `C:\po-vg`: DEFERRED

Unchanged from 04's reading and from the standing note — one unpushed file
(`scripts/pipeline/check-pipeline-heartbeat.mjs`) on a branch that is not among the 11 remote heads,
so it exists in exactly one place. Already escalated. **DEFERRED**; it becomes urgent the moment
F4's prune prompt is armed, which is now explicitly gated.

## WHAT I DID NOT DO

- **Armed nothing.** Both candidate prompts this collect surfaced are deliberately unarmed, each for
  a stated reason (F1: routes to Marco and would be built by stale watcher code; F4: an ordering
  constraint that would destroy the only copy of `#1612`'s work).
- **Did not clear any `[STALE]` line, or any `needs-marco/` file.** That is the exact action 04's
  F1 shows the instrument is wrongly recommending.
- **Did not prune any branch**, including the four closed-unmerged `*verdict-home-resolver*` heads,
  which are harmless where they are.
- **Did not touch the clone, `C:\po-vg`, the 69 stashes, or the 40 untracked `docs/pr-reviews/`
  files.** All 03's.
- **Did not archive 04's breadcrumb or this one** — both are the current cycle. Archive is for what
  has already been dispositioned, and F5's dispatch is still open.
- **Did not re-run 04's own sweep or re-derive its measurements** beyond the two findings that
  drive an irreversible action here (the ten retirements and the DOCTRINE count), which I
  re-measured myself with controls before acting.
