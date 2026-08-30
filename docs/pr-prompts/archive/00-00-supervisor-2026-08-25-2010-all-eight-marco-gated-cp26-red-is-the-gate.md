# Station 00 — Supervisor | 2026-08-25T20:08Z–2026-08-25T20:16Z

## GROUND

```
UTC            2026-08-25T20:08:26Z
origin/main    019c7579
dev tree       main @ b968e4f1  C:\ProjectOperations2   (behind origin/main by 1)
doc version    1
bootstrap      1                 (MATCH — full authority this run)
```

NOT BLIND. Desktop Commander connected on the first call; PowerShell on `LAPTOP-E6NHU4E4`.
Full read AND write coverage — git, `gh`, filesystem.

🔴 **Cowork env said "today is 2026-08-26". Real UTC at start was 2026-08-25T20:08Z.**
`date -u` before any staleness claim. AEST+10 again.

## WHAT I MEASURED

### Board — 8 open PRs, ALL EIGHT watcher-routed to Marco [MEASURED]

`gh pr list --state open --limit 60 --json number,title,headRefName,mergeStateStatus,isDraft,labels`

| PR | mergeState | labels | routing reason (verbatim from the watcher log) |
|---|---|---|---|
| #1325 | CLEAN | `do-not-merge` | `escalates:true - held for Marco, labelled do-not-merge` |
| #1323 | UNSTABLE | `do-not-merge` | `escalates:true - held for Marco, labelled do-not-merge` |
| #1322 | CLEAN | — | `outside tests/ or docs/: apps/web/src/pages/crm/AccountDetailPage.tsx` |
| #1321 | UNSTABLE | `do-not-merge` | `escalates:true - held for Marco, labelled do-not-merge` |
| #1320 | BLOCKED | — | `outside tests/ or docs/: apps/web/src/App.tsx` |
| #1319 | UNSTABLE | `do-not-merge` | `escalates:true - held for Marco, labelled do-not-merge` |
| #1317 | CLEAN | — | `outside tests/ or docs/: .github/workflows/playwright-container-trial.yml` |
| #1316 | CLEAN | — | `outside tests/ or docs/: apps/api/jest.config.ts` |

Probe: `Select-String -Path C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\*.log
-Pattern "stays for Marco" -SimpleMatch` → **592 hits total**, exactly **one per open PR**.
**Positive control:** the same log set carries **1360** `[merge]` lines, so the instrument is not
blind. **RULE 2 therefore gates all eight. I merged nothing, and nothing was mergeable by me.**

🔴 **A label-only check is WRONG on four of eight** — `#1316 #1317 #1320 #1322` carry **no label**
and are routed purely by the `tests-docs` path rule on ONE file each.

### ARMED = 0 [MEASURED], two independent probes agreeing

- depth-1 glob `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → **0**
- `C:\po-watcher\ProjectOperations\scripts\pr-watcher\.queue-state.json` →
  `{"ts":"2026-08-25T20:08:09.286Z","lane":null,"armed":0,"owned":0,"runnable":0}`

### Watcher LIVE — 12-tick GAP series [MEASURED]

`logs/2026-08-24.log` (still the live log) tail, ticks 19:13:09Z → 20:08:09Z, twelve
`[review] verdict-archive sweep: archived=0 kept=8 skipped=0` lines, **every gap 5 m 00 s ±1 s**.
A clean fixed-interval series is the only probe that catches a freeze, and it is clean.
`node_watcher_count 1`. `wrapper_count 0` — known, NOT a fault to "fix": the `PO Watcher
Keepalive` scheduled task is the restarter, and §3b ENSURE-UP relaunching `supervise-watcher.ps1`
is a recorded DEFECT (it starts a second supervisor with the kill loop).

### 🔴 CP-26 is the ONLY red on #1323 — and the red IS the gate working [MEASURED]

`gh run view 32870952059 --job 97877548388 --log`:

```
PASS - CP-11 migrations           PASS - CP-12 env-vars       PASS - CP-13 dependencies
PASS - CP-17 dto-validation       SKIP - CP-09/10 scope       PASS - CP-23 seed-without-migration
PASS - CP-24 sot-purity           PASS - CP-22 verification-checklist
PASS - CP-25 failure-honesty
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human must
       review and REMOVE the label; removing it is what releases the merge.]
##[error]Process completed with exit code 1.
```

**11 of 12 checks SUCCESS; the single FAILURE is CP-26.** This is not a defect to drive green —
it is the human gate, and only Marco clears it. Same shape for #1319 and #1321 (identical single
failing check, identical label).

🔴 **This REFUTES half of the 16:10Z claim that "CP-26 is a race and GREEN BY DEFAULT."**
Measured now: CP-26 fired **RED with the label present** on three PRs (#1319 #1321 #1323), and
**GREEN with the label present** on #1325 (CLEAN + `do-not-merge`). So the race is REAL but
**two-sided** — sometimes the label lands before the gate runs, sometimes after. The consequence
the older note drew still stands and is now sharper: **"green + CLEAN" does not mean "not held",
and "red on CP-26" does not mean "broken".** The `ci.yml` fix (`types: [..., labeled, unlabeled]`)
is confirmed correct and now has direct evidence on both sides.

### 🔴 `check-breadcrumb.mjs --freshness` reported TWO false SILENTs [MEASURED]

Exit 2. `00 last 2026-08-25T16:08:00Z 4.0h ago SILENT` and `03 last 2026-08-24T23:01:00Z 21.1h ago
SILENT`. **Both are instrument defects, not station defects:**

1. **Uppercase in a slug makes a breadcrumb INVISIBLE.** `NAME_RE` at `check-breadcrumb.mjs:39` is
   `/^00-(\d\d)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([a-z0-9-]+)\.md$/` — **lowercase only.**
   The 18:10Z run's breadcrumb is `00-00-supervisor-2026-08-25-1810-BLIND-no-windows-shell-all-8-
   marco-gated.md`. It is on disk (directory listing confirms, mtime 18:12:05Z) and is **absent
   from the instrument's 13-file ADMIT list.** So 00 read as SILENT 4.0 h when it had in fact
   reported 2.0 h earlier. **Positive control:** the same run ADMITted 13 other breadcrumbs, so it
   is not blind in general — only to this filename shape.
2. **The cadence table is stale for 03.** `CADENCE = { '00':2, '02':null, '03':4, '04':4, '05':24 }`
   at `:35`. Station 04's 18:10Z breadcrumb measured 03 as scheduled **DAILY (`0 9 * * *`)**, not
   4-hourly. At a 24 h cadence, 21.1 h is **not** silent.

**Re-ran the instrument after writing this breadcrumb** (positive control on the first defect):
`ADMIT 00-00-supervisor-2026-08-25-2010-…` and `00 last 2026-08-25T20:10:00Z 0.1h ago ok`.
So the only thing that changed 00 from SILENT to ok was **a lowercase filename** — the 18:10Z run
had reported all along. `SILENT: 1 station(s)` remains, and it is 03.

🔧 **And 03's schedule is 09:00 LOCAL, not UTC** [INFERRED, from two measurements]: 03's last
report is `2026-08-24T23:01:00Z`, which is **09:01 AEST on 2026-08-25** — exactly the `0 9 * * *`
cron Station 04 measured at 18:10Z. If the cron were UTC the stamp would read `09:0xZ`. So 03's
next run is due **2026-08-25T23:00Z (~3 h from now)** and it is **not late**. The cadence entry
needs to be `'03': 24`, and any future reader must convert the cron to UTC before judging it.

### 🔴 The board trap RE-ARMED itself again — third occurrence in one day [MEASURED]

`git diff --cached --name-status` in the shared dev-tree index carried
`R100 docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md → …-ready.md`
with **BOTH endpoints absent from disk** (`Test-Path` false on each) and **PR #1325 already open**
for that prompt. The next bare `git commit` would have shipped a tracked depth-1 `*-ready.md`.
This is the shape Station 04 named at 18:10Z: **every arm leaves an orphaned R100 in the shared
index**, and #1323 is the fix and is CP-26-held.

### 🔴 Two DOCTRINE §9 instrument traps hit LIVE this run [MEASURED]

- **§9.4 / §7 guard 8 — piping a `gh --json` array into `Where-Object` collapses it to ONE
  object.** It cost me two wrong readings: first a bogus `fail_count 12` on #1323, then a
  `total 1` whose `.state` printed as twelve space-joined values. Assign-then-foreach was **not
  enough**; only re-parsing with `node` gave the truth (`total 12 notsuccess 1`).
- **§9.1 — `gh api … --jq "…"` re-splits on spaces**, producing `accepts 1 arg(s), received 3`.

Both are already written down. I still walked into them. **Use `node` for every `gh --json` read.**

## WHAT CHANGED

**One mutation.** Drained the orphaned staged rename:

```
git restore --staged docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-HOLD.md \
                     docs/pr-prompts/pr-sot-04-bp0a-job-canonical-reconcile-ready.md
```

**Read back:** `git diff --cached --name-status` → **1 entry before, 0 after**; depth-1
`*-ready.md` count **0 before and after** (the drain did not arm or disarm anything). No commit,
no push, no merge, no label touched.

## FINDINGS

**F1 — All eight open PRs are watcher-routed to Marco; the board cannot move without him.**
Four are fully green and CLEAN (#1316 all 12 checks SUCCESS; #1317, #1322, #1325 CLEAN). The
merge backlog has grown 4 → 7 → 8 across four supervisor runs today. — **ESCALATED** (see below).

**F2 — CP-26 red on #1319/#1321/#1323 is the gate, not a defect.** Do not "drive them green";
the only way to green is Marco removing `do-not-merge`. — **ACTIONED** (recorded; no CI work done,
deliberately).

**F3 — CP-26 is a two-sided race.** `ci.yml`'s `on: pull_request` has no `types:`, so `labeled` is
excluded and the gate never re-runs after the watcher labels. Measured red-with-label ×3 and
green-with-label ×1. Fix: `types: [opened, synchronize, reopened, labeled, unlabeled]`.
— **DISPATCHED to 02-board-driver** (a one-line `.github/workflows/ci.yml` change; 00 may not
open PRs).

**F4 — `check-breadcrumb.mjs` produced two false SILENTs.** Uppercase-slug blindness at `:39` and
a stale `'03': 4` cadence at `:35`. An instrument that under-reports its own inputs will eventually
hide a station that really did die. — **DISPATCHED to 02-board-driver**; two-line fix
(`[A-Za-z0-9-]` in `NAME_RE`, `'03': 24` in `CADENCE`). Until it lands, **do not quote its SILENT
verdict without checking the directory listing.**

**F5 — The orphaned-R100 board trap re-armed for the third time today.** Drained again by hand.
The permanent fix is #1323 (`arm-prompt.ps1` serializer — exclusive lock + index guards), which is
open, 11/12 green, and held by CP-26. **The trap will keep re-arming on every single arm until
#1323 merges, and #1323 cannot merge without Marco.** — **ESCALATED** (this is the same ask as F1,
with a concrete cost).

**F6 — Dev tree is 1 commit behind `origin/main`** (`b968e4f1` vs `019c7579`, #1324's merge).
Harmless today; the watcher globs the dev tree's working files, not its HEAD. — **DEFERRED**;
becomes urgent if a prompt's `requires_file_on_main` gate is evaluated against the dev tree.

**F7 — I armed nothing, on purpose.** ARMED = 0 and the lane is free, so arming was available.
I did not, and this is a decision, not a no-op. Under **RULE 1** — *solve it completely, now and
in future, without damaging existing or future data entry* — arming a ninth prompt would (a) add a
ninth PR to a queue whose only exit is Marco's review, and (b) re-create the orphaned R100 in the
shared index that F5 documents, which is the exact "damages future data entry" half of the rule.
**Trigger to resume arming:** open PR count back below 4, **or** #1323 merged (whichever comes
first). — **DEFERRED**, with that trigger.

## WHAT I DID NOT DO

- **Merged nothing.** All eight PRs carry a `stays for Marco` routing line. RULE 2 is not
  overridden by green, by CLEAN, by an absent label, or by my own reading of the diff.
- **Removed no label.** Only Marco removes `do-not-merge`.
- **Armed nothing** — see F7.
- **Did not relaunch the watcher wrapper** despite `wrapper_count 0`. The Keepalive task owns
  restarts and §3b ENSURE-UP is a recorded defect.
- **Did not commit this breadcrumb.** It is UNTRACKED until a board PR carries it; the shared
  index is now empty and I am not opening a PR (not 00's authority).
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or production data.**

## FOR MARCO — one question, three options

**The board has 8 PRs and every single one is held for you. Four are fully green.** Nothing in the
pipeline can merge until you act, and one of the held PRs (#1323) is the fix for a trap that
re-arms every two hours.

**Option A (complete + additive — recommended).** Review and clear **#1323 first**, then the three
other green ones (#1316, #1317, #1322). #1323 landing removes the recurring index trap permanently,
so the queue stops manufacturing new work for the supervisor. *Passes both halves of RULE 1:*
solves the immediate backlog and the future one, and touches no data.

**Option B.** Clear only the four green/CLEAN PRs (#1316 #1317 #1322 #1325) and leave #1323.
*Fails the "future" half* — the R100 trap keeps re-arming on every arm, indefinitely.

**Option C.** Name a standing exception in chat, e.g. *"docs-only and `sot/`-only PRs opened by a
station chat may be merged by 00 without me."* This unblocks the class permanently without weakening
the gate on code PRs. *Passes both halves, but it is an authorization grant — yours alone to make,
which is why it is an option and not an action.*

Also outstanding, unchanged from earlier runs: the `tests-docs` allow-list question (4th time),
and who commits station breadcrumbs (3rd time — the breadcrumb channel is still untracked).
