# Station 00 — Supervisor | 2026-09-21T18:13:58Z–2026-09-21T18:3xZ

## GROUND

```
UTC            2026-09-21T18:13:58Z
origin/main    939c77bc            (git fetch origin +refs/heads/main:... then rev-parse)
dev tree       main @ 939c77bc      C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (both `1`). No read-only downgrade — **full authority run.**

🟢 **SIGHTED RUN**, said first because a blind run and a healthy quiet run both produce "no news".
Desktop Commander was loaded on the prescribed keyword `ToolSearch` and `start_process` shell
`powershell.exe` returned a live shell on the first call, printing `2026-09-22 04:14` and `main`.
Every measurement below came through that transport except where a line says otherwise.

**Device-bridge git guard installed FIRST, before any VM-side call. Last lines, verbatim:**

```
vm-git-guard installed at /sessions/festive-quirky-feynman/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**Install PASSED.** No `git` ran through the device bridge against the Windows `.git` at any point.

**Binding-document freshness PROVED, not assumed** — in the dev tree, after an explicit fetch, using
the sound form (§9.1: never a piped `hash-object`):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md   -> EMPTY
```

All three read from a working copy proved byte-equal to `origin/main`.

## WHAT I MEASURED

**Sweep verdict, captured to a file rather than streamed** (PREFLIGHT step 4; the streamed form
returned `0 remaining` at 38 lines, then at 118, then at 161 — §9.1's early-return, exactly as
recorded). Captured file `sweep-0922.txt`, **463 lines**, section 7 verbatim:

```
==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**Sweep section 5 carries ZERO genuine `[STALE]` escalation rows.** A raw `[STALE]` grep over the
captured report returns **3** lines and all three are the legend or a quotation — the `generated`
header, the `[LIVE]=…` legend bullet, and a `[FILE]` line quoting an old breadcrumb's prose.
**Nothing for the COLLECT discharge step to clear**, against the eleven the station doc records from
2026-09-10. Section 5's live content is entirely
`cites #N (MERGED) as evidence -- not its premise; does not clear the escalation`, which by its own
wording is not a discharge signal.

**Board, measured live, `gh pr list -R <owner>/<repo>`, exit 0, OPEN_COUNT=5. ZERO DIRTY (Q1).**

| PR | mergeState | labels | head |
|---|---|---|---|
| `#2051` | BLOCKED | `do-not-merge` | `feat/ops-m2b-tipping-review` |
| `#2049` | UNKNOWN | — | `fix/lintstation-contract-version-compare` |
| `#2047` | BLOCKED | `do-not-merge` | `feat/role-grant-registry-v1` |
| `#2044` | BLOCKED | `do-not-merge` | `feat/crmvis-s8-comms-threads` |
| `#2042` | **CLEAN** | — | `feat/scopecards-s4b-push-panel-ui` |

**No PR is DIRTY, so no PR has frozen CI and nothing on the board is blocked on a conflict (Q2 — and
therefore nothing for `pr-zzz-resolve-all-dirty-prs` to do).** `#2049`'s `UNKNOWN` is the cached
rollup not yet recomputed, not a conflict; its checks read 15 pass / 0 fail.

**RULE 2 lane verdicts, RE-TAKEN this run and not carried** (§10.1 — a lane verdict is
non-monotonic and is only as of the minute it was taken). Prompt logs only, `rev-*` excluded:

- corpus **2347** logs; newest `rev-2056-ready.md.log` at **2026-09-21T17:52:11Z**, younger than
  every open PR's `createdAt` (oldest `#2042`, `10:02:39Z`) — **freshness precondition PASSES**;
- POSITIVE calibration `marco.:true` (regex, quote-free per §10.1) → **697**;
- NEGATIVE controls: `PR #999123` over the same corpus → **0**;
  `gh pr view 999123 --json number,state` → exit **1** (two fields, per §9.4's fabricated-row bullet).

| PR | prompt-log hits | verdict, verbatim reason |
|---|---|---|
| `#2042` | 3 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ClientQuotesPanel.tsx"}` |
| `#2044` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |
| `#2047` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - PR already carries do-not-merge - no duplicate apply"}` |
| `#2049` | 1 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-station.mjs"}` |
| `#2051` | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |

Every verdict sits in the log of the prompt that **opened that PR**, named for that PR's own subject
— so none is §10.1's prose-scrape (`PRNUMBER_SCRAPED_FROM_PROSE_V1`). Every reason names a **real
policy path or the escalates flag**; none is the `timeout waiting for green checks + MERGE verdict`
string, so none is a §10.3 timeout wearing a routing's clothes. **Five of five are genuine routings.
RULE 2 binds on all five.**

**Queue census, counted myself (Q3):** `-ready.md` → **0** · `-HOLD.md` → **20** · `*-LOOPING.md` → **0**.
No LOOP, no armed prompt sitting unprocessed, so §3c does not arise.

**Watcher.** Sweep section 2, `[LIVE]`: node **RUNNING pid 9744**, auto-restart wrapper **alive (1)**,
heartbeat age 23 min with an empty queue — which is idle and correct, not wedged (§3a's BUSY/WEDGED
table needs *armed prompts* for WEDGED, and armed is 0). §3b's `wrapper=0` question does not arise
this run and nothing was relaunched.

**Freshness + `lastRunAt` crossed, per the COLLECT table.** `check-breadcrumb.mjs --freshness`:
`structure: 1 checked, 0 malformed`, `CLEAN`, exit **0**.

| station | `lastRunAt` (MCP) | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-21T18:13:58Z` (this run) | `17:14Z` | aligned |
| 03 | `2026-09-21T00:20:35Z` | `00:21Z` | aligned; next `23:02:45Z` |
| 04 | **`2026-09-21T18:09:36Z`** | `14:10Z` | **fresh `lastRunAt`, no breadcrumb — resolved as IN FLIGHT, see F1** |
| 05 | `2026-09-21T14:10:40Z` | `14:11Z` | aligned; next `2026-09-22T14:22:37Z` |

**No station is SILENT.** `weekly-security-audit` remains `enabled: false` — unchanged, already filed.

**Dev tree before I touched anything:** `git rev-list --left-right --count HEAD...origin/main` →
`0 0`; `git diff --cached --name-status` → EMPTY (nothing another chat staged would ride along on my
commit — §9.2); `git diff --numstat` → **`2 2 docs/pipeline/sweep-rotation.json`**, which is F1.

## WHAT CHANGED

1. **`docs/pipeline/sweep-rotation.json` swept into this board PR** — Station 04's advance, which 04
   may not commit itself and which the station doc assigns to 00. Verified complete before
   committing (F1).
2. **One fully-dispositioned breadcrumb `git mv`-ed into `docs/pr-prompts/archive/`** — the 17:14Z
   Station 00 run, every one of whose seven findings already carried a disposition (collected below).
   Safe for freshness (§9.5: `trackedSet` is `git ls-tree -r`, matched by trailing path segment).
3. **This breadcrumb, written INSIDE the PR worktree** — cure 1 of the station doc's FF section, so
   no loose untracked copy is left in the dev tree and the post-merge fast-forward cannot be blocked
   by it.
4. **Nothing else.** No merge of any board PR, no arm, no label touched, no watcher restart, no
   `sot/` edit, no worktree pruned, no process killed.

## FINDINGS

### F1 — Station 04 was LIVE mid-run and writing to the shared dev tree while the sanctioned single-actor instrument reported SAFE TO ACT (S2)

`SINGLE_ACTOR_GATE_IS_BLIND_TO_A_LOCKLESS_STATION_V1`

DOCTRINE §9.5 names the instrument for BOARD DRIVING condition 3 in as many words: *"The
single-actor question is answered by `status-sweep.ps1` section 3."* Condition 3 is the one the
station doc calls **load-bearing** — *"the only thing standing between this design and LL-38."*

**[MEASURED] this run, and the two readings are simultaneous and opposite.**

| instrument | reading | time |
|---|---|---|
| sweep section 3 + section 7 | `git index.lock interactive/clone: False / False` · `git processes touching our trees (scoped): 0` · `no PR touched on GitHub in the last 2 min` · **`SAFE TO ACT`** | 18:16:19Z |
| sweep section 3, the one row that saw 04 | `[INFO] headless claude-code sessions: 2 (INCLUDES this chat — informational, **NOT a blocker**)` | 18:16:19Z |
| `docs/pipeline/sweep-rotation.json` on disk | `last_index` **1 → 2**, `last_run_utc` `2026-09-21T14:10:14Z` → **`2026-09-21T18:09:53Z`**, `last_station: 04-scanner`; file mtime **18:18:39Z** | 18:22:31Z |
| 04's session directory `c2b7cf78` | created **18:09:36.847Z** (= its `lastRunAt` to the millisecond), 17 files, **newest write 18:21:11Z** — 32 s before the probe | 18:21:43Z |

POSITIVE control on the session-directory instrument: **my own** directory `2354ee3b` reads
`created=18:13:58.181Z`, which equals `00-supervisor`'s `lastRunAt` `18:13:58.181Z` exactly, and its
newest write is 1 s old — so the instrument dates a run to the second and detects a live one. The
scan was run with **no name filter** (per the station doc's `local_*` rename note) and returned all
six recent directories, the newest four of which are 8-hex.

🔴 **So a station was demonstrably alive and had mutated a tracked file in the shared dev tree
nine minutes before I read `SAFE TO ACT` from the instrument whose whole job is to answer
"is anything else acting?"** Section 3's probes are git locks, scoped git processes and recent
GitHub writes. Station 04 produces **none** of those: it is `report-only`/read-only on the board, it
holds no worktree, it takes no index lock, and it touches no PR. Its only dev-tree write is
`next-sweep.mjs --advance` plus a breadcrumb — a plain file write that no probe in section 3 watches.

🔴 **The instrument is not blind so much as deliberately deaf, and that is the harder shape.** It
*did* see 04 — `headless claude-code sessions: 2` — and the sweep's own text discounts that row as
`informational, NOT a blocker`. That is correct for the common case (a chat open on Marco's desk is
not a mutation) and wrong for exactly this one. Nothing is empty and nothing warns, so §9.6 never
fires: section 3 answered precisely the question it was asked, about a different quantity from the
one condition 3 asks.

⚠️ **This is the complement of the 17:14Z run's F7, not a repeat of it.** That finding was the sweep
flagging 00's **own** worktree as a live station and refusing 00's own merge — a false alarm. This is
the opposite polarity: a genuinely live station that the safe-to-act gate waves through. Taken
together they say the same thing about sections 2 and 3 — **they classify by WORKTREE, and a
station's liveness is not a property of whether it happens to hold one.**

⚠️ **And the overlap is structural, not bad luck.** `STATION-CAPABILITIES.md` §6 already records it
with its own measurement: `00` is `5 * * * *` (hourly) and `04` is `0 */4 * * *`, so *"an hourly
`5 * * * *` lands inside ten minutes of every one of them **by construction**"* — six collisions a
day. This run: 04 at `18:09:36Z`, 00 at `18:13:58Z`, **262 seconds apart**. Every one of those six
daily overlaps puts 00 at its board mutation while 04 is mid-run, with the gate reading SAFE.

**DISPOSITION: ACTIONED — I did not reason past the gate; I established the missing fact and then
acted on the narrower, provable claim.** What 04's run had actually done to the shared tree was
measured in full before I committed anything: the advance is **one** write per run and it had already
happened (`last_run_utc` = this occurrence, file mtime 18:18:39Z, `--numstat` `2 2`, and the diff is
exactly the two-line index/timestamp bump and nothing else). A file whose single scheduled write for
the run is complete is not a race, so sweeping it into this board PR — which is what the station doc
instructs 00 to do with this exact file — is safe, and I read back the diff before staging. **I did
not touch anything else 04 might still write**, which is why 04's own breadcrumb (not yet on disk)
is left for the next collect rather than waited on.

🔴 **RULE 1 — why this is the complete-and-additive option.** It solves the immediate half (this
run's mutation is provably safe, on evidence rather than on the gate's silence) and it names the
durable half for the station that owns instruments, without my editing `status-sweep.ps1` — a
`scripts/` change, outside my lane to merge, onto a board where five PRs already wait only on Marco.
It damages nothing: no probe is weakened, no verdict is overridden, and the session-directory
measurement is additive evidence rather than a replacement for section 3. The alternatives each fail
a half: *"the sweep said SAFE, proceed"* fails the immediate half, because the gate had not measured
the thing it was being trusted for; *"CAUTION by default whenever a second headless session exists"*
fails the future half, because it would stop 00 on six of its own runs a day for a session that is
usually not mutating — and a gate that fails that often is disabled by its first reader.

**DISPATCHED → Station 04.** The durable question is an instrument change and is yours, and it is
the same section this run's predecessor already dispatched to you (its F7, worktree liveness), so
these two should be answered together rather than separately. **The question: can section 3 promote
`headless claude-code sessions` from `[INFO]` to a real signal by asking whether any OTHER session
directory under the `local-agent-mode-sessions` tree has been written to inside the last N minutes —
excluding the caller's own, which is identifiable by matching `lastRunAt` — and report
`CAUTION: another station is mid-run` rather than the current unconditional `NOT a blocker`?**
⚠️ **Falsifying probe: run `status-sweep.ps1` while a second station session is demonstrably writing
(newest file write under its session directory < 60 s old) and read section 7.** If it returns
anything other than `SAFE TO ACT`, this finding is wrong and must be re-measured.

### F2 — COLLECT: the 17:14Z breadcrumb, all seven findings dispositioned and re-verified, now archived (S3)

The queue root held exactly **one** breadcrumb, `git ls-files`-confirmed tracked at
`docs/pr-prompts/` and **not** also at `archive/` — the duplicate-basename check the station doc's
archiving section requires, run against the TRACKED set rather than against the dev tree. Every
finding in it already carried a disposition; each was re-verified against the live system rather
than repeated (§7.1's re-read rule), and the breadcrumb is `git mv`-ed to `archive/` in this PR.

| finding | its disposition | re-verified this run |
|---|---|---|
| F1 — `pr-queue-layout-sot-entry-HOLD.md` would have handed `sot/` to Station 01 | ACTIONED + DISPATCHED → 05 | **HOLDS.** Marker present at line 16, `1` hit; `lint-prompt.mjs` → `REJECT [HUMAN_GATE_PRESENT]`, exit **1**. The prompt cannot be armed by accident. **The dispatch to 05 is still open** — 05's next occurrence is `2026-09-22T14:22:37Z`. |
| F2 — `#2042`'s e2e re-run came back green | ACTIONED | **HOLDS.** `#2042` reads `mergeStateStatus: CLEAN`, no labels, this run. Probe discharged. |
| F3 — all five open PRs are `marco:true` | ESCALATED → Marco | **HOLDS, re-taken from scratch** — the five-row table in WHAT I MEASURED, with fresh controls. Carried forward as F3 below. |
| F4 — two worktree items | DISPATCHED → 03 | **HOLDS, both still present** in this run's sweep: `C:/PR-Master/worktrees/po-vg` (dirty=1, age 25,101 min, do NOT `--force`) and `C:\po-worktrees\po-fix-2005` (size 0 KB, age 5,916 min, `.lock=False`, prune). 03's next occurrence is `23:02:45Z`. |
| F5 — `check-breadcrumb.mjs` reads 00's cadence as 2 h | DEFERRED | **HOLDS.** Anchor `const CADENCE =` still reads `{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }` against a live `5 * * * *`. Carried as F4 below. |
| F6 — four carried escalations | ESCALATED → Marco | **HOLDS, unchanged.** The bootstrap that opened THIS run still carries the stale `.gitignore` line citation. |
| F7 — 00's own board worktree trips its own merge gate | ACTIONED + DISPATCHED → 04 | **HOLDS, and the cure worked:** this run's sweep reads `no live station worktrees` in section 7, taken before I created mine — so the predecessor's teardown landed. Its dispatch to 04 is still open and is now paired with F1 above. |

**DISPOSITION: ACTIONED.** Collected, re-verified, archived. Three dispatches remain outstanding and
are named again here so they are visible in one place rather than buried in an archived file:
**→ 05** (the `sot/02` `QUEUE_LAYOUT_V1` entry), **→ 03** (the two worktrees), **→ 04** (worktree
liveness, now joined by F1's session-liveness question).

### F3 — All five open PRs carry a live `marco:true` routing; two are fully green and waiting on one human action each (S2)

Re-taken live, with controls, not carried — the table is in WHAT I MEASURED. **Armed prompts: 0.
Zero DIRTY. Nothing on the agent side of this board is waiting on work.**

- **`#2042`** — `CLEAN`, unlabelled, 15/15 green. Needs a merge and nothing else.
- **`#2049`** — unlabelled, 15/15 green (`mergeStateStatus: UNKNOWN` is the cached rollup, not a
  conflict). Needs a merge and nothing else.
- **`#2044`, `#2047`, `#2051`** — green apart from the two CP-26 reds their own `do-not-merge` label
  creates. Read as `[LABEL_PRESENT]` (§9.4): **parked by design, nothing to fix.** Removing the
  label is the entire remaining action on each, and only you can take it.

This is the throughput constraint stated exactly: every PR touching anything outside `tests/` or
`docs/` stops at the same place by design, RULE 2 forbids any station from clearing it — *"not
overridden by green, unlabelled, or a verified diff"* — and the board grows monotonically until you
merge. **That is why I armed nothing even though the sweep said SAFE TO ACT**, and why arming faster
would make the queue longer rather than shorter.

**DISPOSITION: ESCALATED** — Marco. Unchanged in substance from the 17:14Z report one hour ago; it
is repeated because it is still the answer to Q6 and repeating it costs less than a reader assuming
it moved. No new `needs-marco/` file is filed, because
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` already names this
class.

### F4 — `check-breadcrumb.mjs` still reads 00's cadence as 2 h against a live HOURLY cron (S3)

`[MEASURED]` at `939c77bc`, anchor `const CADENCE =`:
`{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`, against the scheduled-tasks MCP's
`00-supervisor  cronExpression: "5 * * * *"` — hourly. `03` (24), `04` (4) and `05` (24) all match
their live crons; **00 is the only wrong row**, and it is wrong in the direction of not noticing a
missed run: `--freshness` will not call 00 SILENT until **4 h**, i.e. only after **three**
consecutive missed hourly runs. This run's `ok` for 00 is therefore a weaker statement than the same
word about any other station — which is why the `lastRunAt` cross above is not optional, and why it
is the cross and not `--freshness` that resolved 04's row this run.

**DISPOSITION: DEFERRED**, unchanged from the 17:14Z run and for the same reason. The fix is one
character (`'00': 1`) in `scripts/`, so a PR carrying it is outside `tests|docs` and becomes a
**sixth** PR on a board where five already wait only on Marco — motion, not progress. **What would
make it urgent:** a missed 00 occurrence that `--freshness` reports `ok`. The `lastRunAt` cross is
the compensating control and it ran clean this cycle.

## WHAT I DID NOT DO

- **Merged nothing on the board.** All five open PRs carry a live, re-taken, cross-checked watcher
  `marco:true` verdict. `#2042` and `#2049` are both green and unlabelled and I still did not merge
  them, because green is not the gate.
- **Armed nothing.** Armed count in = 0, out = 0. The queue's one never-arm candidate is correctly
  gated and the other gate-satisfied HOLDs are confirmed duplicates of open PRs.
- **Removed no label.** Only Marco does that — it is the entire remaining action on three PRs.
- **Did not wait for Station 04 to finish.** Its run was live at 18:21:11Z and its breadcrumb was not
  yet on disk; blocking this run on another station's run would cost 00's whole hourly slot, and the
  next collect picks it up on the normal cadence. I committed only the one file 04 had provably
  finished writing (F1) and nothing else of its output.
- **Did not edit `status-sweep.ps1`.** F1's durable half is a `scripts/` change and Station 04's
  question; touching it here would put a sixth PR on a parked board and take an instrument outside
  my lane.
- **Touched no `sot/` file.** That is 05's lane and CP-24 enforces it.
- **Pruned no worktree and killed no process.** Both worktree items are 03's; the `po-vg` one holds
  a blob that differs from `origin/main` and `--force` would destroy it.
- **Restarted nothing.** Watcher node alive (pid 9744), wrapper alive (1), armed 0 — an idle watcher
  with nothing armed is correct, not wedged.
- **Did not chase sweep section 5.** Zero genuine `[STALE]` rows; its live content is all
  `cites #N (MERGED) as evidence — not its premise`, which does not clear an escalation.
- **Left Azure / Entra / SharePoint entirely alone**, as always — absolute.
