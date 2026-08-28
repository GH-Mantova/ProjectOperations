# Station 00 — Supervisor | 2026-08-26T08:09:00Z–08:16Z

## GROUND

```
UTC            2026-08-26T08:09:00Z
origin/main    a57d22c5  (at start)  ->  7ded569c  (at end, after #1327 merged + FF)
dev tree       main @ a57d22c5 -> 7ded569c   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority, not read-only.
**NOT BLIND.** Desktop Commander present; `start_process` returned `LAPTOP-E6NHU4E4` at 08:09:00Z.
This is the 8th run in 6 days where DC presence was in question and the 4th consecutive *present*
one since 06:10Z was absent — reinforcing INTERMITTENT, not structural.

## WHAT I MEASURED

- `[MEASURED]` **Board went from 4 Marco-gated PRs to EMPTY.** `gh pr list --state open` at 08:10Z
  returned exactly one PR (#1327); at 08:16Z, zero. `#1316 #1320 #1323 #1325` all merged between
  07:00Z and 07:58Z, plus `#1326` (46 breadcrumbs) and `#1322 #1319 #1317`. `git log origin/main`
  confirms all on main.
- `[MEASURED]` **#1327 was blocked by a PENDING check, not a failing one.** Full rollup, 12 checks:
  11 SUCCESS/SKIPPED/NEUTRAL, `Analyze (javascript-typescript)` IN_PROGRESS. `mergeable=MERGEABLE`,
  `labels=[]`, 17 files all under `docs/pr-prompts/`.
- `[MEASURED]` **#1327 is NOT watcher-routed.** `Select-String 'stays for Marco'` over the live log
  returned 12 hits, none for 1327; `Select-String '1327'` returned zero lines. Control: the same
  query returns #1311–#1325. **RULE 2 does not attach to it.**
- `[MEASURED]` **Watcher LIVE and NOT frozen.** node pid 29024 (cmdline `pr-watcher[\\/]index\.mjs`),
  started 08-24 15:35. `.queue-state.json` `ts` field: 08:08:04.759Z -> 08:13:04.767Z = a
  **300.008 s** gap, the exact tick interval. Then it **picked up the prompt I armed 26 seconds
  after I armed it** — `[queue] ... (depth: 1, source: watch)` at 08:13:30.815Z.
- `[MEASURED]` **`wrapper_count=0` is NOT a fault.** `supervise-watcher.ps1` is absent, but
  `\PO Watcher Keepalive` is `state=Ready lastResult=0 lastRun=18:05:02 nextRun=18:15:00` (local).
  §3b ENSURE-UP would have started a SECOND supervisor with a kill loop against a working restarter.
  **Did not run it.**
- `[MEASURED]` **Station 03's SILENT verdict is a FALSE POSITIVE.** `check-breadcrumb.mjs
  --freshness` (exit 2) reports `03 last 2026-08-25T23:01Z 9.2h ago (cadence 4h) SILENT`.
  `list_scheduled_tasks` gives 03's real cron as **`0 9 * * *` — DAILY**, lastRun 2026-08-25T23:01Z,
  nextRun 2026-08-26T23:00Z. 03 is exactly on schedule. `CADENCE['03']=4` is wrong, and it will cry
  SILENT for ~16 of every 24 hours. Control: 04's `0 */4 * * *` matches its constant and reads `ok`.
- `[MEASURED]` **#1325's `do-not-merge` gate came off TWICE, and the second time it merged.**
  From `gh api .../issues/1325/events`:
  `08-25 16:29:17Z labeled` · `08-26 07:22:09Z unlabeled` · `07:38:41Z labeled` (06's restoration)
  · **`07:57:18Z unlabeled`** · **`07:57:28Z merged`** — ten seconds later.
  `gh pr view 1325` gives `mergedBy=GH-Mantova labelsAtMerge=[] auto=YES`.
- `[MEASURED]` Dev tree FF was blocked by an **untracked** working-tree copy of the 06 breadcrumb
  that #1327 landed as tracked (77 lines both sides). Not the `metadata-catalog.json` CRLF trap.
- `[MEASURED]` Armed = 0 at start; 61 depth-1 `pr-*.md`, 57 `-HOLD.md` before FF, 56 after.

## WHAT CHANGED

- **Merged #1327** via native squash auto-merge (`gh pr merge 1327 --auto --squash
  --delete-branch`, exit 0). Read back: `state=MERGED autoMerge=ENABLED by GH-Mantova
  method=SQUASH`. Docs-only, unlabelled, not watcher-routed. This retires the 16 executed HOLDs and
  lands 06's 07:53Z breadcrumb.
- **Fast-forwarded the dev tree** a57d22c5 -> 7ded569c, after removing the redundant untracked copy
  of the 06 breadcrumb (verified identical, 77 lines, and recoverable from `origin/main` — it was
  restored by the FF and `breadcrumb_06_restored=True`). Incoming `-ready.md` count checked FIRST:
  **0**, so the FF could not arm anything. 17 files changed, 1784 deletions, `ff_exit=0`.
- **ARMED `pr-gate-release-is-not-a-reject`** (HOLD -> ready). Armed went **0 -> 1**, verified on
  disk, and `git diff --cached --name-status` carries **only** that path.
  The first `git mv` FAILED (`fatal: not under version control`) — the prompt was **untracked**, the
  same self-blocking trap already recorded for two other HOLDs. Cured with `git add` then `git mv`.
  Pre-arm checks: staged=0, no `index.lock`, lint **ADMIT** exit 0, premise exit 0 (= still needed),
  the exact grant literal present, body read for `do-not-arm` (its "Do NOT arm... as part of this
  PR" is a scope limit on the WORK, not a marker on itself), last main commit 13.4 min old.

## FINDINGS

### F1 — Station 04's sixteen resurrectable HOLDs are gone from main and from the dev tree
04 reported them at 06:11Z with a control (retirement buckets non-empty). #1327 removed all 16 and I
FF'd the dev tree, so the `git checkout` / `reset --hard` resurrection class is closed for this set.
Verified: `pr-crm-winrate-display-HOLD.md` absent, HOLD count 57 -> 56.
**DISPOSITION: ACTIONED.**

### F2 — 🔴 the reserved PR merged ten seconds after its gate came off, and 06's "impact was zero" is REFUTED
06 escalated at 07:53Z that #1325's `do-not-merge` had been removed by an unattributable actor, and
re-applied it. It recorded `auto=NONE` and "it never approached merging". **Both are now false.**
The label came off a **second** time at 07:57:18Z, auto-merge was armed (`auto=YES`), and the PR
merged at 07:57:28Z. #1325 is the one item Marco explicitly reserved. Every actor — Marco, every
station, every `gh` call — presents as the shared `GH-Mantova` token, so attribution is impossible
by construction, exactly as 06 said. The innocent reading fits the evidence well: Marco merged
#1316/#1320/#1323 in the same 58-minute window and is the one person entitled to clear his own gate.
But the system cannot distinguish that from the alternative, and it did not merely wobble this time —
**it merged.**
**DISPOSITION: ESCALATED** — see the question at the end.

### F3 — `check-breadcrumb.mjs` calls Station 03 SILENT for 16 hours out of every 24
`CADENCE['03'] = 4` against a real cron of `0 9 * * *` (daily). Its exit 2 is a real signal being
spent on a false alarm, which is how a true one gets ignored. One-line fix; 00 does not open PRs.
Pairs with the still-open defects from my 06:10Z run: it silently drops UPPERCASE breadcrumb slugs,
ignores a file argument, and reports exit 0 when piped.
**DISPOSITION: DISPATCHED** — Station 04, next instrument-honesty sweep, together with the 06:10Z set.

### F4 — a staged prompt that was never committed cannot be armed, for the fourth time
`pr-gate-release-is-not-a-reject-HOLD.md` was untracked, so `git mv` refused it — the same failure
recorded for `pr-hygiene-gitignore-no-pr-opened` and `pr-watcher-idle-tick-liveness`. I cured this
one with `git add`, but the general shape stands: 06 stages prompts into the dev tree, 00 cannot
open PRs, so staged work never reaches `main` and a fresh clone cannot see it.
**DISPOSITION: DISPATCHED** — Station 06, to carry the two remaining untracked HOLDs in its next
staging PR.

### F5 — DC absence is intermittent, and this run proves it again
06:10Z was blind; 08:09Z reached the box on the first call from the same listed task. Seven blind
runs in six days, interleaved with reaching ones. "Cloud-fired and structurally blind" stays refuted.
**DISPOSITION: DEFERRED** — the standing escalation from 06:26Z (gate the run on DC being connected)
is with Marco and needs no second copy.

## WHAT I DID NOT DO

- **Did not touch #1325.** It is merged, it is Marco's, and unwinding a merge is irreversible.
- **Did not run §3b ENSURE-UP** despite `wrapper=0` — the Keepalive restarter is Ready with
  lastResult 0, and §3b would have started a competing supervisor. §3b remains a recorded defect.
- **Did not arm a second prompt.** One at a time; the watcher is mid-run on this one.
- **Did not arm** `pr-unified-api-key-vault-slice4c-retire-old-screens` (body demands 4b "merged AND
  verified"; nothing records *verified* — Marco's call), nor the two prod-data / table-drop prompts.
- **Did not open a docs PR for this breadcrumb.** Marco declined a standing exception ~1 h ago and
  took a one-off sweep instead; doing it again by reflex would be that exception without the
  decision. **This file is UNTRACKED.** The durable copy is in PROJECT MEMORY.
- **Did not chase the label-removal actor** past the shared token — that needs audit-log access no
  station has.
- **Did not touch #1329** — `docs(pr-prompts): correct a wrong measurement in the linter blind-spot
  prompt`, which appeared at some point before 08:21Z, i.e. *while this run was working*. It is not
  mine and not from the prompt I armed (that one is still running). A concurrent chat is active;
  merging into another actor's live work is the LL-38 collision. Left for its author or the next run.
  `[MEASURED]` `gh pr list --state open` at 08:21:25Z: exactly `#1329`.

---

## THE ESCALATION — for Marco

**Did you take the `do-not-merge` off #1325 at 07:57:18Z, and arm auto-merge on it?**

If yes, nothing is wrong and this closes — but I have no way to tell, and neither will the next run.
If no, then a gate you personally reserved released itself twice in 35 minutes and the PR merged ten
seconds after the second release.

The underlying problem either way: **Marco, every station and every `gh` call all act as the shared
`GH-Mantova` token**, so `do-not-merge` records *that* it moved and never *who* moved it. Options,
complete-and-additive first:

1. **An append-only gate ledger + branch-protection rule that requires it.** A merge on a reserved PR
   must carry a signed release record naming a distinct identity; the label becomes a display of that
   record rather than the control. Solves it now (attribution exists) and in future (no new gate can
   be released unattributably), and damages no existing or future data entry — it only adds a record.
   Costs: needs a second identity/token for the stations, which is yours to authorise.
2. **Give the stations their own GitHub identity, keep the label as-is.** Solves attribution
   completely; but it does **not** solve *future* releases going unobserved — a wrong actor is still
   only visible if someone reads the event log. Fails the "future" half.
3. **Alert-on-unlabel only** (a webhook that pings you when `do-not-merge` comes off). Cheap and
   immediate, but purely detective — it never *prevents* the merge, and it adds nothing durable.
   Fails the "completely" half.

I did not act on any of these: options 1 and 2 are authorization grants, which are yours alone.
