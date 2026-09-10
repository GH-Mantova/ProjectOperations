# Station 00 — Supervisor | 2026-09-10T11:40Z–2026-09-10T12:0xZ

## GROUND

```
UTC            2026-09-10T11:40:39Z
origin/main    e48d2a82            (fetch --prune, then rev-parse)
dev tree       main @ e48d2a82     C:\ProjectOperations2   (0 ahead / 0 behind, 9 untracked, 0 modified)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` returned a live prompt on the first call.

All three binding documents were read in full from the working copy **after** proving the working
copy is byte-identical to `origin/main` by the sanctioned probe — no pipe, no length comparison:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY**. [MEASURED]

**vm-git-guard: INSTALL FAILED — reported, not stopped on.** The contract requires the installer's
last line be quoted pass or fail. Last line, verbatim:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
... is under Plan9 share "c" which is not mounted
```

The VM transport was unreachable for the whole run, so no VM-side `git` could have been run against
the mount and no `index.lock` exposure arises. This is the **second consecutive run** to record this
same failure — Station 04 quoted the identical last line at 10:1xZ. Desktop Commander was present
throughout, which is the transport that matters.

`status-sweep.ps1` captured to a file (it returns early and hides its own section 7 otherwise) and
decoded `utf16le` — the capture was **130,004 bytes** opening `FF FE`, the trap section 9.3 names.
Section 7 verdict: **SAFE TO ACT**. Section 0 positive controls both passed.

## WHAT I MEASURED

Fresh needles minted for this run — `zqQ00Needle20260910T1140` with suffixes `b`, `c`, `d` — **0
hits everywhere they were used**, and spent the moment this file lands.

### The board, and it is the whole of it

[MEASURED] 11:41:39Z. **3 open PRs, all CLEAN, all 15 pass / 0 fail / 0 pending, all unlabelled —
and every one of them carries a LIVE watcher `marco:true` verdict.**

| PR | age at 11:4xZ | watcher verdict, verbatim from `processed/pr-*.log` |
|---|---|---|
| `#1845` | 2.1 h | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` |
| `#1832` | 11.5 h | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` |
| `#1823` | 35.6 h | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |

**RULE 2 probe calibration, tree PINNED to `C:\ProjectOperations2\docs\pr-prompts\processed`** (never
the clone decoy): 2113 logs · newest `rev-1847-ready.md.log` at **11:08:29Z**, younger than the
oldest open PR by 35 hours · POSITIVE `marco.:true` written without a quote character → **628** ·
NEGATIVE freshly-minted needle → **0** · NEGATIVE `PR #999999` → **0**.
**And the control that proves `NO LOG` means second lane rather than broken probe:** `#1847`, a
board docs PR this station's lane opened, read **0** prompt-log hits while all three open PRs read 2.

All three are unlabelled. Per the standing rule that is not a clearance: removing `do-not-merge`
does not clear RULE 2, and step 1 of section 10.1 runs first and wins. **Nothing on this board was
mergeable by me.**

### Arming — 0 of 10, with BOTH control layers passed

`triage-holds.ps1` at 11:5xZ: **41** `-HOLD.md` at depth 1 · spent **0** · gates-satisfied **10** ·
still-gated **31** · unreadable **0**. One duplicate candidate flagged
(`pr-company-manage-s1-permission-and-grant-HOLD.md`, 1 of 4 against `#1823`) — an overlap of one
entry is a candidate and never a verdict, and it is moot because that prompt is Marco's anyway.

I then classified all ten against `classifyPolicyFiles` using the **CRLF-explicit** front-matter
parser that landed at 08:5xZ today, and — this is the point of section 9.3's bullet — **controlled
the EXTRACTION step separately from the DECISION step**:

```
EXTRACTION CONTROLS  POS(expect 2)=2  NEG(expect 0)=0
DECISION CONTROLS    docs/x.md=true  a/__tests__/b.mjs=true  a/b.spec.ts=true
                     scripts/c.ps1=false  migrations=true
```

Scope counts parsed `8 6 4 2 5 6 3 6 4 1` — non-zero on all ten, which is what the broken `\s*\n`
matcher could not produce. Result: **TESTS-DOCS ELIGIBLE = 0 of 10.** Three fail on
`apps/api/prisma/migrations/**`, six on a path outside `tests|docs`
(`apps/web/src/lib/contrast.ts`, `.github/workflows/playwright.yml`, three `apps/api/src/modules/**`,
`apps/api/src/modules/rates/charge-step-parity.service.ts`), one on
`scripts/pipeline/triage-holds.ps1`.

### The occurrence gap, and the instrument that reported it healthy

`check-breadcrumb.mjs --freshness` at 11:4xZ: structure 4 checked / 0 malformed, `CLEAN`, exit 0,
and `00  last 2026-09-10T08:08:00Z  3.6h ago  (cadence 2h)  ok`.

That `ok` is false, and finding F1 measures why.

Scheduled-tasks MCP: `00-supervisor` `cronExpression 5 * * * *`, `enabled true`,
`lastRunAt 2026-09-10T11:40:17.124Z` — **this run**, so `lastRunAt` cannot answer a question about
any earlier occurrence. The third instrument, the session directory, can.

### Machinery

Watcher node RUNNING pid 18228 · auto-restart wrapper alive (1) · heartbeat 34 min (ticks only
mid-run; stale + empty queue = idle, not wedged) · watcher clone `branch=main dirty=0` · guard hook
present · `index.lock` False / False · git processes 0 · no PR touched in the last 2 min.

Two non-main worktrees, and **neither is safe to prune**: `C:/po-vg` at **8868 min** (6.2 days)
holding one uncommitted file — `git -C C:\po-vg status --porcelain` → `?? scripts/pipeline/check-pipeline-heartbeat.mjs`,
already escalated and 03's lane — and `C:/po-worktrees/pr1823` (810 min, clean), which is the head
branch of **`#1823`, still OPEN**. Named here so no later run reads "orphaned" as "deletable".

## WHAT CHANGED

Everything below happened in a **disposable worktree** off `origin/main`
(`C:\po-wt\st00-1140`, branch `docs/st00-1140-doctrine-s9-probe-transport`), never in the dev tree
and never in the watcher clone. This breadcrumb was written INSIDE that worktree, so no loose
untracked copy exists in the dev tree to block the next fast-forward.

1. **`docs/pipeline/DOCTRINE.md`** — Station 04's dispatched F1 and F6, landed with their proposed
   wording. Edited with **node, by concatenation** (never a replacement string — section 9.3), and
   the **byte delta was asserted**: before 146,337 → after 149,522, delta **3,185 actual against
   3,185 expected, MATCH**. Old F1 anchor gone `true`, both new passages present exactly once,
   negative control 0. A read-back that only looks for what you wrote cannot see what you spilled;
   this one looked.
2. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` re-recorded to
   `8e3b97e5a54d5fdf`. `lint-station.mjs` read `REJECT: 1 of 8` before (one document, not seven —
   `instruments v2` is DOCTRINE-only) and `ADMIT: all 8 docs clean`, exit 0, after.
3. **Four collected breadcrumbs `git mv`-ed to `docs/pr-prompts/archive/`** — every finding in them
   now carries a disposition, below.
4. **This breadcrumb.**

Nothing was armed, disarmed, merged, labelled, rebased or closed. No `/sot/` edit. No production
data. No Azure, Entra or SharePoint.

Outside the PR: one paragraph appended to the existing gitignored escalation
`docs/pr-prompts/needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`
(F1). Scratch scripts under `C:\po-sup-fix-scripts\`, captures under `%TEMP%` — both outside the repo.

## FINDINGS

### F1 — Three consecutive Station 00 occurrences never fired, the cause was Station 00 itself, and `--freshness` reported `ok` throughout. S2.

The already-filed escalation says a long 00 run "eats the next occurrence". Today it ate **three**,
and that is the first time the mechanism has been measured at the only size that matters — the size
at which the freshness detector is calibrated to miss it.

[MEASURED] 2026-09-10T11:4xZ at `e48d2a82`, from the session-directory instrument, which is the only
one of the three that can answer a question about an *earlier* occurrence:

| 00 occurrence due (UTC) | session directory | duration |
|---|---|---|
| 00:08 … 07:08 (eight runs) | present | 19–35 min each |
| **08:08** | `local_2e0fdd10` created `08:08:07Z`, last file write **`11:39:52Z`** | **3 h 31 min** |
| **09:08** | **ABSENT** | never fired |
| **10:08** | **ABSENT** | never fired |
| **11:08** | **ABSENT** | never fired |
| 11:40 (off-cron) | `local_ece458fc` created `11:40:17Z` | this run |

**POSITIVE control:** every other 00 session today is on disk with a plausible duration, and
`04-scanner`'s 02:10 / 06:09 / 10:09 directories are all present — so an absent directory is a real
absence and not retention. **The 11:40 fire began 25 seconds after the long run's last write.**

**Why this is S2 rather than a curiosity.** Three instruments were asked and two answered wrongly:

- `lastRunAt` reads `11:40:17Z` — mine. It holds only the most recent run, so it is structurally
  incapable of seeing the hole, and it now looks perfectly healthy.
- `check-breadcrumb.mjs --freshness` printed `00 … 3.6h ago (cadence 2h) ok` — because
  `CADENCE['00']` is still `2` while the live cron is hourly. At the correct cadence, 3.6 h is past
  2× and 00 reads **SILENT**. `STATION-CAPABILITIES.md` section 6 predicted exactly this: the wrong
  row "will not call `00` SILENT until 4 h, i.e. only after **three** consecutive missed hourly
  runs." **Three is what happened, 3.6 h is where it landed, and `ok` is what it said.** The
  prediction is now a measurement.
- Only the session directory saw it.

**And the cause is the part that was not on file.** The existing escalation and the standing record
attribute missing 00 runs to a crash, a `529` on turn one, or the desktop app being down. None of
those applies here: the 08:08 run was *healthy and productive* — it merged `#1844` (09:57Z), `#1846`
(10:44Z) and `#1847` (11:10Z). **Station 00's coverage gap was manufactured by Station 00 doing its
job slowly**, and the scheduler skipping an occurrence while the previous instance is live is the
only hypothesis consistent with all thirteen directories. Three hours of board coverage were lost
with no defect anywhere for a later run to find, and the one detector pointed at it said `ok`.

RULE 1 on the options, complete-and-additive first:

- **(a) Cap the run and fix the detector, together.** `CADENCE['00'] = 1` (one character), plus a
  self-imposed wall-clock budget in the station doc after which a 00 run lands what it has, writes
  its breadcrumb and exits rather than continuing into the next slot. Complete: it removes both the
  cause and the blindness. Additive: it discards no work — the run still lands what it finished, and
  the next occurrence picks up the rest from the breadcrumb. **Neither half damages existing or
  future data entry.** Costs a `scripts/` change, which is outside 00's merge lane.
- (b) Fix only `CADENCE['00'] = 1`. Fails the "future" half: the detector would now shout, but 00
  would still eat its own slots and the alarm would fire every time it did.
- (c) Do nothing and rely on `lastRunAt`. Fails both halves — it is the instrument that cannot see
  this by construction.

**ESCALATED.** Appended to the existing
`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md` rather
than filed as a new escalation — the subject is the scheduled-tasks layer plus a `scripts/` change,
both outside 00's merge lane, and re-raising a live filing is the failure this pipeline keeps paying
for. **The falsifying probe is the table above:** group the session directories under
`…\local-agent-mode-sessions\` by `CreationTimeUtc` and cross them against 00's cron. If a run ever
overruns its slot and the next occurrence's directory is present anyway, this finding is wrong.

### F2 — Station 04's F1 and F6 landed, and its F2 was already discharged. S3 (collect).

Station 04's 10:10Z breadcrumb dispatched three items to me. Dispositions, each verified live rather
than read from the breadcrumb:

| 04's finding | disposition |
|---|---|
| **F1** — the `AUTOMATIC_VARIABLE_ASSIGNMENT_V1` falsifying probe is routed through the `-Command` expansion trap and is unfalsifiable in the direction it protects | **ACTIONED** — landed in section 9.1 with 04's proposed wording plus the four-transport measurement and the discriminator that tells a reader which of the two opposed cures fired. Byte delta asserted, canonical block re-recorded, `lint-station.mjs` exit 0. |
| **F6** — assign-then-count does not rescue an empty STRING, which is what every failed `gh` call returns | **ACTIONED** — landed as a clause on the existing `ConvertFrom-Json` bullet in section 9.4, with 04's three-row table and both controls, and generalising the CWD bullet's `$LASTEXITCODE` cure to every cause of a failed `gh` call. |
| **F2** — fold `.arming-log.txt` into the board PR; the publication gap is open by one line | **ACTIONED — already discharged before I read it.** [MEASURED] `git status --porcelain` in the dev tree at 11:4xZ returns **nine `??` entries and ZERO modified**, so the log is clean against HEAD; `#1846` ("carry a second actor's arm into main") landed it at 10:44Z, 26 minutes after 04 wrote the dispatch. **Re-doing it would have been a no-op commit against a false premise.** This is the re-read rule earning its keep: 04's measurement was true at `a2fa8e4e` and false by the time it reached me. |

04's F3 (the `CADENCE['00']` row) it correctly DEFERRED as already-filed, naming its own trigger:
*"what would make it urgent: a missed `00` run that `--freshness` reported as `ok`."* **That trigger
fired today, three times over — see F1.** Its F4 (36 cached remote-tracking refs against 12 real) is
dispatched to 03 and stays there; F5 and F7 it DEFERRED with stated triggers and I have added
nothing to either.

**ACTIONED.**

### F3 — Every armable prompt on this board lands on Marco, and so does every open PR. S3.

This is the throughput constraint stated exactly, and both halves were measured this run rather than
quoted: **3 of 3 open PRs carry a live `marco:true` verdict**, and **0 of 10 gate-satisfied HOLDs is
`tests-docs` eligible**. The `tests-docs` lane is not broken — it merged 48 PRs with no human and its
`ok:true` count is re-measurable — it is **starved of eligible work**, because everything left in the
queue touches `apps/`, `scripts/`, `.github/` or `migrations/`.

So arming anything today would open a fourth PR that Marco must also merge, behind one that has
already waited 35.6 hours. **Arming faster makes the queue longer, not shorter.**

**DEFERRED — I armed nothing, deliberately.** What would make this urgent, and it is a different
thing from "the queue is long": a gate-satisfied HOLD appearing that IS `tests-docs` eligible (arm it
immediately — that one costs Marco nothing), or an open PR blocking a `requires_merged` chain behind
it, which none of these three does. The standing question of how docs-and-tests work gets into a
queue that no longer produces any is already with Marco and is not re-raised here.

## WHAT I DID NOT DO

- **Did not merge anything.** All three open PRs carry a live watcher `marco:true` verdict, and
  section 10.1 step 1 runs first and wins. Their being green, CLEAN and unlabelled changes nothing —
  removing `do-not-merge` does not clear RULE 2, and only Marco clears it, in chat, for that batch.
  `#1823` additionally carries its own receipt at `docs/decisions/merge-approvals/1823.md` inside its
  own diff; that is the known CP-26-armed-by-labelling hole, it is already escalated, and it is not a
  release.
- **Did not arm.** F3 gives the reason and the trigger that would reverse it. `arm-prompt.ps1` was
  not called, so `.arming-log.txt` is untouched by this run.
- **Did not restart, kill or investigate the watcher.** `restart-watcher-if-wedged.ps1` was not
  needed: the sweep read node RUNNING pid 18228 with the wrapper alive and an empty queue, which is
  *idle*, not wedged. A stale heartbeat with 0 armed prompts is the correct state, not a fault.
- **Did not prune either worktree.** `C:/po-vg` holds an uncommitted file and is already escalated;
  `C:/po-worktrees/pr1823` belongs to an OPEN PR. Both are 03's lane and a `--force` prune would
  discard real work.
- **Did not run `git` from the VM against the mount.** The transport was down all run, so the
  question did not arise; the guard install failure is quoted in the ground block and carried as a
  finding rather than treated as a stop.
- **Did not touch `/sot/`** (Station 05's, CP-24), **Azure, Entra or SharePoint** (absolute), or
  production data.
- **Did not open a new `needs-marco/` file for F1.** A live filing already names the mechanism; I
  appended the measurement to it. Filing a second one splits the evidence and is how a discharged
  escalation gets re-raised a week later.
- **Did not sweep the three long-standing untracked files in the queue root**
  (`.queue-sync-ledger.txt`, `queue-watch-state.md`, `archive/review-escalations-516-1346/`). They
  predate this run by days, none is a station breadcrumb, and committing files whose provenance I
  have not established is how a duplicate lands.
- **Did not re-raise 04's F4, F5 or F7**, or the `CADENCE` row as a new escalation. They are
  dispatched or deferred with stated triggers and re-filing them costs the next run its collect.
