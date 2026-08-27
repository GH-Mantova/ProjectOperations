# Station 00 — Supervisor | 2026-08-26T20:09:40Z–2026-08-26T20:26Z

## GROUND

```
UTC            2026-08-26T20:09:40Z
origin/main    549537a4            (fetched +refs/heads/main:refs/remotes/origin/main this run)
dev tree       main @ 7ad50697     C:\ProjectOperations2   (8 BEHIND origin/main)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE — this run was NOT read-only-by-mismatch.
**This was a SIGHTED run.** Desktop Commander `start_process` shell `powershell.exe` returned a live
prompt on the first call; positive control `$probe='CONTROL-OK'` echoed `PROBE=CONTROL-OK`, so `$`
survives `interact_with_process` (it is only `-Command "..."` that strips it).

## WHAT I MEASURED

### Instruments and their controls

- `[MEASURED]` Shell control: `PROBE=CONTROL-OK` + `UTC=2026-08-26T20:09:40Z`. Instrument sound.
- `[MEASURED]` `gh pr list --state open` → **0**. Positive control `--state all --limit 6` → **6**
  rows returned. So "zero open PRs" is a real reading, not an empty-world artefact (§9.6).
- `[MEASURED]` `git ls-files docs/pr-prompts/` → **440** entries (positive control non-empty).
- `[MEASURED]` do-not-arm grep, all three syntaxes, positive control
  `pr-524-rates-b-slice2-canonical-HOLD.md` → `upper=1`. **The control FIRES.** (The older remembered
  control, `pr-siteid-notnull-backfill-HOLD.md`, is false — 04 refuted it at 18:11Z and I did not use it.)
- `[MEASURED]` `git ls-tree -r --name-only origin/main -- apps/api/src/modules/tendering/` → **69**
  files, including `capacity.service.ts`. The query can see files.
- `[MEASURED]` `capacity.service.ts` on `origin/main` = 12162 b, `contains getLeastLoaded = True`,
  negative control `contains zzzNotAThing = False`.

### Board

- `[MEASURED]` **OPEN PRs = 0.** The board is completely empty.
- `[MEASURED]` **#1337 is CLOSED, NOT merged** — `closedAt 2026-08-26T19:03:00Z`, `mergedAt` empty,
  `labels=[]`. It was the only open PR at the 18:11Z run. Consistent with Marco splitting the rates
  slice at ~17:59Z (`pr-rates-consumers-s3a-export-only-HOLD.md`, export half only).
- `[MEASURED]` `main` = **`549537a4`**, unchanged since 17:54Z (#1342). Last five: #1342 #1341 #1340
  #1339 #1338 all MERGED.
- `[MEASURED]` ARMED `*-ready.md` at depth 1 **= 0** at 20:12:54Z. HOLD control = **51**.
- `[MEASURED]` `git diff --cached --name-status` before I acted carried exactly one entry, **not mine**:
  `R100 pr-sot-02-reconcile-2026-08-19-HOLD.md → …-ready.md` — the orphaned residue of my own 16:42Z
  arm, whose work shipped as #1342.

### Machinery

- `[MEASURED]` Watcher node **PID 29024, started 2026-08-24T05:35:04Z** — the **same PID** the 16:09Z
  run measured. No restart ⇒ **the clone's code is the running code**. Cmdline resolved, not counted by
  image name (9 `node.exe` total; exactly one matches `pr-watcher[\\/]index\.mjs`).
- `[MEASURED]` `restart-watcher-if-wedged.ps1` (report-only, no `-Fix`) at 20:20:50Z:
  `armed prompts waiting: 1 · watcher ALIVE (pid 29024) · restart churn 0 in 20 min ·
  queue last moved 238 min ago · heartbeat last write 1 min ago ·`
  **`VERDICT: BUSY — DO NOT restart.`**
- `[MEASURED]` `\PO Watcher Keepalive`: state Ready, lastRun 20:05:01Z, **lastResult 0**, next 20:15:00Z.
  Wrapper count = 0 — **not a fault**; the Keepalive task is the restarter and it is green.
  §3b ENSURE-UP was deliberately NOT run (it starts a SECOND supervisor).
- `[MEASURED]` No `index.lock` in the dev tree. No `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD`.
  No `STOP-WATCHER` or `STOP-WATCHER-LANE2` sentinel at any of four paths.
- `[MEASURED]` `status-sweep.ps1` 20:09:52Z §7: **`SAFE TO ACT` — no board mutation in progress, no
  recent remote activity.** Re-measured immediately before the arm (20:12:54Z: armed 0, openPRs 0,
  no lock, pid 29024).
- `[MEASURED]` Clone `C:\po-watcher\ProjectOperations` parked on `feat/orphaned-discharge-guard`.
  Not corrupt — "off main is not broken". Untouched.

### Collection — breadcrumbs since my 18:11Z run

- `[MEASURED]` Files written under `docs/pr-prompts/` in the last 3 h: **five**, and all five predate
  18:21Z — Marco's `pr-rates-consumers-s3a-export-only-HOLD.md` (17:59:04Z) and two `needs-marco/`
  files (17:59:36Z, 18:00:01Z), plus the 00 and 04 breadcrumbs of the 18:11Z cycle itself.
  **No station has written anything since 18:20:21Z.** That is quiet, not silent — see below.
- `[MEASURED]` `check-breadcrumb.mjs --freshness`: exit 1. structure 44 checked / **7 malformed**
  (all seven are Station 06) / 7 skipped as pre-contract. freshness: 00 ok · 04 ok · 05 ok ·
  **03 reported SILENT (21.2 h, "cadence 4h")**.
- `[MEASURED]` `list_scheduled_tasks`: **03's cron is `0 9 * * *` — DAILY, not 4-hourly** —
  `lastRunAt 2026-08-25T23:01:13Z`, **`nextRunAt 2026-08-26T23:00:45Z`**. 03 is ON SCHEDULE.
  Also confirmed: only **00, 04, 05, 03** are scheduled; `weekly-security-audit` is disabled;
  **06 still has no scheduled task.**

## WHAT CHANGED

1. **ARMED one prompt** — `git mv docs/pr-prompts/pr-ew-s2b-alloc-engine-core-HOLD.md
   docs/pr-prompts/pr-ew-s2b-alloc-engine-core-ready.md` (exit 0), at ~20:13:30Z.
   **Read back on disk:** armed **0 → 1**, the single entry is
   `pr-ew-s2b-alloc-engine-core-ready.md`, and the `-HOLD.md` path is gone (`Test-Path` = False).
   **Read back in the index:** `git diff --cached --name-status` now shows my `R100` plus the one
   pre-existing orphan, and nothing else.
2. Nothing else. **No merge, no label change, no PR opened or closed, no prompt disarmed, moved,
   deleted or edited, no `/sot/` touch, no watcher restart, no commit.** Scratch script written to
   `C:\po-sup-fix-scripts\arm-check-2026-08-26-2009.mjs`, outside the repo.

## FINDINGS

### FINDING 1 — the board was completely empty with the machine idle; I armed EW-2b  [S1]

`[MEASURED]` 0 open PRs, 0 armed, watcher alive and idle, `SAFE TO ACT`. Nothing was in flight and
nothing was queued: the pipeline had stopped for want of an arm, not for want of health.

Candidate chosen from Station 04's 18:11Z dispatch (six gate-verified, tracked candidates; this one
named "lowest-risk first arm"). I re-verified every claim myself rather than trusting the note:

| check | result |
|---|---|
| tracked | ✅ `git ls-files` returns the path (control: 440 entries) |
| `requires_on_main: capacity.service.ts :: getLeastLoaded` | ✅ RELEASED — present on `origin/main`, neg-control False |
| premise `! test -f …/allocation.service.ts` | ✅ LIVE — absent from `origin/main` (pos-control: 69 files seen, `capacity.service.ts` among them) |
| do-not-arm, all 3 syntaxes | ✅ `html=0 upper=0 mixed=0`; **positive control fires** at 1 |
| `docs/approvals/` gate | ✅ none |
| `requires_merged` | ✅ none |
| already shipped? | ✅ no — merged board has only #1316 (EW-2a, the predecessor) and #1274 (EW-1 schema) |
| lint | ✅ `ADMIT (size 4)`, exit 0, with `gh` **present** (so not the §9.5 false REJECT/ADMIT case) |
| STANDING AUTHORITY literal | ✅ body carries the exact `STANDING AUTHORITY to finish the work, commit, push` substring — not a paraphrase (LL-53) |
| `escalates` | `false`; no prisma, no migration, three files in scope |

It also unblocks four downstream HOLDs (`s2c`, `s2d`, `s3`, `s4`) whose gates point at what it creates.

**DISPOSITION: ACTIONED** — armed, read back on disk and in the index (armed 0 → 1), and the watcher's
own health check now reports `armed prompts waiting: 1` with a 1-minute-old heartbeat. **ONE arm only**;
the remaining five candidates stay HOLD for the next run.

### FINDING 2 — #1337 is CLOSED unmerged; RULE 2 on it is discharged, and two escalations died with it  [S2]

`[MEASURED]` `closedAt 2026-08-26T19:03:00Z`, `mergedAt` empty. The `marco:true` PR that RULE 2 held
back at 18:11Z is gone from the board — **closed, not merged**, so RULE 2 was honoured, by me and by
whoever closed it. **Who closed it is UNATTRIBUTABLE** (all actors merge/close as `GH-Mantova`) and per
the standing lesson that is not evidence of a defect; circumstantially it is Marco, who split the slice
at 17:59Z and filed the replacement HOLD.

Consequence, `[MEASURED]` from `status-sweep.ps1` §5: **two `needs-marco/` escalations now reference a
CLOSED PR and are DEAD** — `rates-consumers-persona-handler-and-11c-2026-08-26.md` and
`rates-consumers-slice3-blocker-2026-08-26.md`. Their *content* (the 16-prisma-call blocker, the
materialdensity conflict) is still live; only their #1337 framing is dead.

**DISPOSITION: ACTIONED** — recorded here and in project memory as dead-by-reference. **Do not report
either as a pending #1337 escalation.** I did not delete them: they carry Marco's live rates context and
deleting his escalation channel is not my call.

### FINDING 3 — `check-breadcrumb.mjs` calls Station 03 SILENT every single 00 run, and it is wrong  [S2, instrument]

`[MEASURED]` The freshness table asserts `03 … (cadence 4h) SILENT`. The scheduler says 03's cron is
`0 9 * * *` — **daily** — last run 2026-08-25T23:01:13Z, **next run 2026-08-26T23:00:45Z**. At 21.2 h
elapsed against a 24 h cadence, 03 is not merely un-silent, it has not even become due.

So `CADENCE['03'] = 4` in `scripts/pipeline/check-breadcrumb.mjs` is a false alarm that fires on
**every** 00 run, in the one instrument whose entire job is to tell 00 which station to chase. A check
that cries wolf on a healthy station every two hours is the §7 failure mode: a broken measurement of a
working system. The fix is one number: `'03': 24`.

**DISPOSITION: DISPATCHED** to Station 06 — stage a one-line prompt changing `CADENCE['03']` from `4`
to `24` in `scripts/pipeline/check-breadcrumb.mjs`. ⚠️ **06 has no scheduled task** (re-confirmed this
run), so this dispatch has no autonomous reader; it is a queued instruction for the next time Marco
fires 06 by hand — which is a working path (both 17:59Z/18:00Z `needs-marco/` files are stamped "Filed
by Station 06 … at Marco's request"). The "schedule 06" escalation was already raised at 16:09Z and is
**not re-raised here**.

### FINDING 4 — `.remember/now.md` is NOT the watcher heartbeat, and I nearly built a finding out of it  [S2, instrument]

`[MEASURED]` I used `C:\po-watcher\ProjectOperations\.remember\now.md` as an ad-hoc liveness signal. It
was written at 20:14:20Z, then again at 20:14:50Z, then **froze for the next 6 minutes** while I watched
an armed prompt sit unconsumed. That reads exactly like a stalling watcher.

The sanctioned instrument disagreed and won: `restart-watcher-if-wedged.ps1` at 20:20:50Z reported
**heartbeat last write 1 min ago**, `restart churn 0`, `VERDICT: BUSY — DO NOT restart`. Had I trusted
`now.md` I would have been one step from restarting a healthy watcher on a stale-file argument — the
exact 2026-07-13 incident the station doc opens with.

**DISPOSITION: ACTIONED** — `now.md` is retired as a liveness probe and recorded as such in project
memory. Liveness is `restart-watcher-if-wedged.ps1`, PID identity, and arm-to-pickup. Nothing else.

### FINDING 5 — 7 malformed breadcrumbs, all Station 06, all untracked  [S3]

`[MEASURED]` `check-breadcrumb.mjs` exit 1: 44 checked, 7 malformed, and all seven are
`00-06-pr-master-*` — no `# Station <NN>` heading, FINDINGS with no disposition, one with sections out
of order. Every one is also `UNTRACKED`, so 06's report channel reaches nobody until a board PR commits
them. Unchanged in count and cause since 16:09Z.

**DISPOSITION: DEFERRED** — already escalated at 16:09Z as part of "06 has no schedule, so both its
report channel and its dispatch channel are shut". Re-raising the same finding every two hours is noise,
and the fix is the same scheduling decision. **It becomes urgent the moment a station OTHER than 06
produces a malformed breadcrumb** — that would mean the contract itself has drifted rather than one
station having never adopted it.

### FINDING 6 — two staged residues in a SHARED index, and an uncommitted rotation file  [S3]

`[MEASURED]` `git diff --cached --name-status` carries `R100 pr-sot-02-reconcile-2026-08-19-HOLD.md →
…-ready.md` — the orphan of my 16:42Z arm, whose work shipped as #1342 and whose `-ready.md` no longer
exists on disk. Mine (`pr-ew-s2b`) now sits beside it. Separately, Station 04 left
`docs/pipeline/sweep-rotation.json` as an **uncommitted working-tree edit** (`last_index: 0` ⇒ next
sweep is `instrument-honesty`), deliberately, because the dev tree is on `main` and committing here
would fork it.

Neither is damage. The rotation file is read from the **working tree**, so the next 04 run reads the
correct value with no commit. The orphan is inert.

**DISPOSITION: DEFERRED** — clearing the orphan means touching a git index **shared with concurrent
chats**, and every tool for it (`reset`, `checkout`) is on the board-trap list that resurrects consumed
prompts. The risk exceeds the benefit while it is inert. **It becomes urgent the moment anyone commits
in this tree without a pathspec** — so: `git commit -- <path>`, always, and read
`git diff --cached --name-status` first.

### FINDING 7 — Marco's own replacement HOLD is gate-released but UNTRACKED, and arming it is his call  [S2 → ESCALATE]

`[MEASURED]` `pr-rates-consumers-s3a-export-only-HOLD.md` was written 2026-08-26T17:59:04Z, its gate
(`rate-resolver.service.ts :: listRates`) is RELEASED, and it is **untracked** — so `git mv` would
refuse it and arming needs a `git add` first. It is the export-only half Marco carved out when he split
SLICE 3 and then closed #1337 at 19:03Z.

I did not arm it, for two reasons: it is Marco's in-flight design decision made ninety minutes ago and
he left it as a HOLD, not a `-ready`; and the standing rule is ONE arm at a time, which EW-2b now holds.

**The question for Marco, RULE 1 applied:**

- **(A) — complete and additive.** `git add` the five untracked HOLDs so every prompt on the board is
  armable by rename, then arm `s3a` on a later cycle when EW-2b has landed. Solves it immediately (s3a
  becomes armable) and permanently (an untracked prompt can no longer be structurally unarmable), and
  damages nothing — tracking a file changes no behaviour. **Passes both halves.**
- **(B)** Arm `s3a` now, `git add` only that one. Fails the *future* half: the other four untracked
  HOLDs stay invisible to `git mv`, and the set has already moved once (it was 4, now 5).
- **(C)** Leave all five untracked and re-measure each run. Fails the *immediate* half: two
  gate-released prompts stay unarmable for no reason.

**DISPOSITION: ESCALATED** — Marco, is `s3a` yours to arm when you are ready, or should 00 arm it on the
next quiet cycle? And may 00 `git add` the five untracked HOLDs as ordinary board hygiene (option A)?

## WHAT I DID NOT DO

- **Did not merge anything.** There was nothing to merge — 0 open PRs. RULE 2 was never reached.
- **Did not arm a second prompt.** Five other gate-released candidates remain HOLD; ONE AT A TIME.
- **Did not arm** `pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md` despite its
  `requires_merged: 1111` being MERGED — 04 measured a live prose gate at `:35` demanding slice 4b be
  *merged AND verified*, and nothing records *verified*. It remains the most arm-able-looking trap on
  the board.
- **Did not restart the watcher, and did not run §3b ENSURE-UP.** Verdict was BUSY with a 1-minute
  heartbeat, and ENSURE-UP would have started a second supervisor alongside a green Keepalive.
- **Did not touch the watcher clone's git**, which is parked on `feat/orphaned-discharge-guard`
  (parked ≠ corrupt).
- **Did not fast-forward the dev tree** (8 behind). An FF is only safe with the watcher stopped, and I
  had just armed a prompt into a live queue.
- **Did not commit anything**, including this breadcrumb — `CLAUDE.md` forbids committing to `main`, and
  00 does not open PRs (LL-38). ⚠️ **This breadcrumb is UNTRACKED until a board PR commits it.**
- **Did not delete the two dead `needs-marco/` escalations** (FINDING 2) or edit
  `docs/pipeline/sweep-rotation.json` (FINDING 6).
- **Did not edit `/sot/`, touch Azure/Entra/SharePoint, or write production data.**
