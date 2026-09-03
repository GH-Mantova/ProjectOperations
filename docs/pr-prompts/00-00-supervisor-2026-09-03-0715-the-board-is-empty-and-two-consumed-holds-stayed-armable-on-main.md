# Station 00 — Supervisor | 2026-09-03T07:08Z–2026-09-03T07:20Z

## GROUND

```
UTC            2026-09-03T07:08Z
origin/main    0d67adb1
dev tree       main @ 0d67adb1   C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1
bootstrap      1
```

Versions AGREE — this run was not read-only.

**SIGHTED.** `start_process` shell `powershell.exe` returned PID 33260 on the first call. This was
not a blind run. The three binding documents were read in full and each was proved current:
`git diff --stat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **empty**, so the working copies read ARE
`origin/main`.

## WHAT I MEASURED

**[MEASURED] The board is EMPTY. `gh pr list --state open` returns zero rows.**
`status-sweep.ps1` 07:09:58Z: `OPEN PRs: 0`. This is the first empty board recorded in these
breadcrumbs. There was nothing to merge, nothing to drive green, nothing DIRTY. **Q1 answer: zero
open PRs, therefore zero DIRTY.**

**[MEASURED] `main` CI on the full 40-char SHA is green so far.**
`gh run list --commit 0d67adb10bd5bc6cc2d5bda37806437be764e23e` → Push on main `success`, CI
`success`, Deploy `success`, Tendering Browser Smoke `in_progress`. **Not yet fully green** — one
run outstanding at the time of writing. (§9.4: the full SHA was used; a short SHA answers `[]`.)

**[MEASURED] The `tests-docs` auto-merge lane fired THREE more times in one hour, with no human.**
`Select-String -Path docs\pr-prompts\processed\*.log -Pattern 'merge result'`:
`PR #1531: {"ok":true}` (06:29:17Z) · `PR #1534: {"ok":true}` (07:02:56Z), and `#1532` merged
06:31:08Z earlier this morning. Positive control for the RULE-2 probe on the same corpus:
`-Pattern 'marco.:true'` → **603** hits, so the probe is calibrated and its silence here is real.
**This is falsifying evidence against escalation #21's second cause (lane occupancy).** Four
docs-only PRs opened and merged inside ~35 minutes with overlapping windows and **not one** timed
out. #21's *first* cause (a timeout writing `marco:true` in the byte-identical format to a policy
routing) is untouched by this and remains open on Marco's ruling — option (1), a DISTINCT reason.

**[MEASURED] The watcher and its supervision are healthy.**
`restart-watcher-if-wedged.ps1` (no `-Fix`) 07:12:55Z: `VERDICT: HEALTHY - no action.` —
node ALIVE pid 26656, restart churn 0 in 20 min, heartbeat 0 min old, queue moved 32 min ago.
Sweep §2 independently: wrapper alive (1), clone `branch=main dirty=0`, guard hook present.
**ENSURE-UP: no action taken** — the wrapper is present, so §3b's relaunch does not apply, and
`wrapper=0` was never read this run.

**[MEASURED] Q3, counted myself: armed = 1.**
`Get-ChildItem docs\pr-prompts -Filter *-ready.md` → exactly one,
`pr-wbsshift-s2-api-pricing-reads-shift-ready.md`. No `rev-*-ready.md` present, so no review job
needed excluding. **No `*-LOOPING.md` anywhere** (`-Recurse` → empty). No agent running >45 min.

**[MEASURED] That arm is not mine, and it is the fourth unattributed arm in 28 hours.**
`.arming-log.txt` tail: `2026-09-03T07:03:21Z ARMED pr-wbsshift-s2-api-pricing-reads-shift
escalates=true by=Marco@ pid=34284`. My run began 07:08Z — **five minutes after it.** The same log
records 03:40:31Z (`pr-vmguard-s1`), 06:05:18Z (`pr-plandocs-s1`) and 06:32:42Z
(`pr-artifactregister-s1`). `by=Marco@` is the shared OS account and attributes nothing (standing
finding), and the sweep counted **2 headless claude-code sessions**, one of which is me.

**[MEASURED] Two prompts consumed and auto-merged this morning were STILL TRACKED on `origin/main`
as `-HOLD.md`.** For each of `pr-artifactregister-s1-track-the-brief-index-HOLD.md` and
`pr-plandocs-s1-prod-runs-legacy-not-ratetable-HOLD.md`:
`git cat-file -e origin/main:docs/pr-prompts/<f>` → **exit 0 (present)**, while
`docs/pr-prompts/processed/` holds their `-ready.md` and a `{"ok":true}` merge log, and the dev
tree carries only an uncommitted ` D`. Positive control: the third ` D`,
`pr-wbsshift-s2-…-HOLD.md`, is present on main **correctly** — that one is armed and in flight.
So the deletion existed nowhere durable: **any `git checkout .`, `reset --hard` or fresh clone
re-materialises both, ADMIT, and they arm again.** This is the third and fourth measured instance
of the general defect (`pr-gates-approval-receipt-HOLD` was consumed twice, → `#1492`, `#1493`).

**[MEASURED] `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.** 18 structures checked, 0
malformed. No station SILENT: 00 0.8h · 03 32.2h (24h cadence) · 04 1.0h · 05 41.0h.

**[MEASURED] Mutation gate, immediately before I acted.** Sweep §3: in-progress prompts 0 ·
`index.lock` interactive/clone **False/False** · git processes **0** · no PR touched in 2 min ·
§7 `SAFE TO ACT`. Re-checked before push (below).

**[MEASURED] Housekeeping the sweep names and I am NOT clearing.** 3 orphaned worktrees
(`C:/po-1483-fix` 1730 min · `C:/po-sa-fix` 92 min · `C:/po-work/s2-e2e` 1858 min, all `dirty=0`)
plus 1 registry escapee `C:\po-worktrees\fix-1523` (0 KB, 93 min, no `.lock`). `needs-marco/`
holds 10 files, of which two are already suffixed `.RESOLVED-…` / `.RETRACTED-…`.

## WHAT CHANGED

One PR, docs-only, opened from a disposable worktree at `C:\po-wt\00-0715` off `origin/main`
(torn down at the end of the run). It carries exactly four things:

1. `git mv` of the two consumed HOLDs into `docs/pr-prompts/superseded/` — the durable retirement.
2. `docs/pr-reviews/pr-1529-review.md`, swept in (Station 06 dispatched it to me; see D5).
3. `docs/housekeeping/REPO-MAP-2026-09-02.md`, untracked in the dev tree since 09-02.
4. This breadcrumb.

**Nothing was armed. Nothing was merged. No label was touched. `sot/` untouched. No code.**

## FINDINGS

**F1 — A consumed prompt's `-HOLD.md` survives on `main`, so a consumed prompt stays armable
forever.** Two fresh instances this morning, measured above. The arming primitive `git mv`s
`HOLD → ready` in the **working tree only**; `-ready.md` is gitignored at `.gitignore:75`, and
nothing commits the deletion. The PR the prompt produces does not retire its own source.
**ACTIONED** — both HOLDs `git mv`'d to `docs/pr-prompts/superseded/` in this PR; verified by
`git status --porcelain` showing `R docs/pr-prompts/… -> docs/pr-prompts/superseded/…` for both,
and read back after push (see below). This cures the two instances, **not the mechanism.**

**F2 — The mechanism behind F1 is still unstaged and wants a queue check.** Nothing detects
"tracked `-HOLD.md` on `main` whose `-ready.md` is in `processed/`". Every occurrence so far was
caught by eye, and one (`pr-gates-approval-receipt-HOLD`) was consumed **twice** before anyone
noticed. **DISPATCHED → Station 06 (PR Master)**: stage a prompt adding that check to
`queue-sync.ps1` (or a new `scripts/pipeline/check-spent-holds.mjs`), reporting each spent HOLD by
name. Its premise is executable: `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
intersected with the basenames in `docs/pr-prompts/processed/`. **Do not fold it into
`pr-gates.mjs`** — CP-26 failing already takes `PR gates — diff checks` down with it, and a second
assertion in the same file doubles that blast radius.

**F3 — Four arms in 28 hours were made by an actor that is not this station, one of them five
minutes before this run started.** RULE 4 is *arm ONE AT A TIME* and the authority matrix says
**only 00 arms**. Three of the four produced clean auto-merged docs PRs, so no damage has occurred
— but the design's load-bearing safety property is DOCTRINE §8/BOARD-DRIVING condition 3, *single
actor*, and it is not currently true. `.arming-log.txt` cannot answer *who*: `by=Marco@` is the
shared OS user, and the log is untracked so it exists on this box and nowhere else.
**ESCALATED** — see `docs/pr-prompts/needs-marco/unattributed-arms-single-actor-2026-09-03.md`.
Written as a question with options, RULE 1 applied, complete-and-additive option first.

**F4 — `#1529` (MISSING_STANDING_AUTHORITY is now a REJECT) leaves two prompts unarmable until
their bodies are edited.** The review verdict swept in by this PR names them:
`tfm-s11-copy-recursive-preserve` and an `escalates:true` SharePoint writer. That is the intended
behaviour, not a regression, but it is a silent one — the prompts will simply refuse to arm.
**DEFERRED** — neither is in flight and neither is on any chain that is. It becomes urgent the
moment someone tries to arm either and reads `REJECT` as "the premise died". Whoever next needs
one adds the grant sentence to its body; no prompt is required for a two-line edit.

### COLLECT — breadcrumbs written since my 06:25Z run

Exactly one is new: `00-06-pr-master-2026-09-03-0640-addendum-d3-decided-and-the-tip-id-chain-is-staged.md`.
Everything else in the tracked set at 06:10/06:15 was dispositioned by the 06:25Z run. Its five
findings, each given one of the four dispositions — this is the channel that closes:

- **D1 (its F1) — D3 is DECIDED: option (d), the rate row carries the `MapLocation` id.**
  **ACTIONED by 06 already** (chain staged: `pr-tipid-s1` ADMIT size 3, `s2`/`s3` correctly
  `REJECT [GATE_NOT_RELEASED]`). My disposition: **DEFERRED to arm.** `s1` is armable and inert on
  landing, but RULE 4 is one at a time and `pr-wbsshift-s2` is armed and in flight. **`pr-tipid-s1`
  is the next arm** — ahead of `pr-visualreview-s1`, which my 06:25Z run named, because s1 unblocks
  a decided three-slice chain whereas visualreview unblocks one sibling.
  The three options in the backlog register `map-locations-waste-rate-coupling` are **superseded**
  and must not be re-presented; option (a) is refuted (a Prisma FK cannot point into a JSON cell).
- **D2 (F2) — `pr-tipid-s3` is bound to 11c and carries a two-part hard stop, only half of which is
  machine-gateable.** **DEFERRED**, and correctly so by its author. Recorded here so the next run
  does not read `s3`'s REJECT as a dead premise.
- **D3 (F3) — the module holding the TIP rename guard has never had a test.** **ACTIONED by 06**
  (s3 writes the failing half first). Nothing for me.
- **D4 (F4) — "is there a waste-rate facility with no TIP?" now has an instrument** (s2's backfill
  reports unmatched by name). **ACTIONED by 06.** This closes the residual unknown that has sat in
  the register since 2026-08-19.
- **D5 (F5) — `docs/pr-reviews/pr-1529-review.md` is untracked and unclaimed, dispatched to me.**
  **ACTIONED** — swept into this PR. 06 was right to leave it: `#1532` was open at the time.

### Carried dispatches — still open, restated so they do not expire

- **→ Station 06:** the four §9 instrument-drift findings from 04's 06:10Z run become **ONE**
  doc-reconcile prompt. Three of them edit the hash-gated `instruments v2` block, so the prompt
  MUST run `lint-station.mjs --write-canonical` in the same PR or CI rejects it. **DISPATCHED**
  (restated from 06:25Z; not yet staged).
- **→ Station 03:** worktree and clone hygiene — the 3 orphaned worktrees and the registry escapee
  measured above, plus the 8 dead `needs-marco/` files the sweep tags `[STALE]` every run (MOVE to
  `needs-marco/discharged/`, never delete). **DISPATCHED** (restated; open since 08-31).
  🔴 One correction to that list: **`ruleset-requires-four-checks-…-2026-09-01.md` is NOT dead.**
  The sweep tags it `[STALE]` because every PR it names is merged, but it carries the surviving
  half of open escalation #15 — `Pipeline — watcher + linter tests` is still ADVISORY, and that is
  the job that took `main` red for 32 minutes on `#1482`. **AMEND it, never bin it.**
  `needs-marco/pr-1532-review-fix.md` (references `#1532`, merged 06:31Z) **is** genuinely dead and
  is safe to discharge.

### Q6 — the ONE thing blocking progress right now

**Nothing is blocking the board; the board is empty.** Zero open PRs, zero DIRTY, watcher HEALTHY,
one prompt armed and in flight. The binding constraint is unchanged and structural: every PR that
touches anything outside `tests/` or `docs/` routes to Marco, so arming faster lengthens his queue
rather than shortening it. `pr-wbsshift-s2` is `escalates=true` and will land there too.

## WHAT I DID NOT DO

- **Did not arm anything.** RULE 4 is one at a time and `pr-wbsshift-s2-…-ready.md` is armed and
  unconsumed. `pr-tipid-s1` is next; `pr-visualreview-s1` after it.
- **Did not disarm or quarantine `pr-wbsshift-s2`** despite not knowing who armed it. DOCTRINE §5b
  is explicit: arming IS the decision to run, and a cautious sweep of `escalates: true` prompts on
  the strength of the flag alone is a measured past incident. It will open a PR, get
  `do-not-merge`, and wait for Marco — which is the designed outcome.
- **Did not merge anything.** There was nothing open to merge, so this run's board mutation was a
  PR opened, not a PR landed. `Assert-SmokedOrEscalate` / `Merge-Pr` were not called.
- **Did not clear the two named never-arm prompts.** `pr-cardui-s2-wbs-table-shell-HOLD.md` (while
  `#1483` is open) and `pr-tr-s1-reminder-policy-HOLD.md` (size 9, `gate_allow: migrations`,
  Marco's) both stand off, unchanged.
- **Did not prune any worktree or clear any lock** — Station 03's lane, and no lock existed.
- **Did not sweep `docs/pr-prompts/queue-watch-state.md`** (38.7 KB, last written 08-31) or
  `.queue-sync-ledger.txt`. Both are **state**, not instructions, and the contract says state does
  not go into tracked documents where it reads as current forever. Deliberate, and restated each
  run so it does not silently become an oversight.
- **Did not sweep `docs/pr-prompts/archive/review-escalations-516-1346/`** — 146 untracked files.
  Real archive work, but a 146-file diff does not belong in a collect PR. **DEFERRED**; it wants
  its own PR and no urgency attaches to it.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, production data, any label, or the watcher
  clone's git.** No `git checkout .`, `reset --hard`, `stash pop` or `clean` anywhere.

---

## ADDENDUM 07:25Z — a new instrument lie, caught by its own positive control

While re-checking the board immediately before push I asked "how many PRs are open?" two ways and
got two different answers. **[MEASURED], with both controls, on `gh` 2.90.0 / PS 5.1:**

| Form | open PRs (truth: 0) | merged `--limit 3` (truth: 3) |
|---|---|---|
| `@($raw \| ConvertFrom-Json).Count` | **1** | **1** |
| `(ConvertFrom-Json $raw).Count` | **0** | **3** |
| raw `--json` text | `[]` | 3 rows |

The first form answers **1 to both questions** — an empty board and a three-row board are
indistinguishable, and `1` is wrong for each. It reads as *"one PR is open"*, which is exactly the
false statement that would have made this run go looking for a PR to drive. It is the same family
as DOCTRINE §9.4's *assign-then-foreach* bullet (piping a JSON array into `Where-Object` collapses
it to ONE object — the bug that once let the merge queue select `#552`), but §9.4 names
`Where-Object` and `--jq`, not `@(… | ConvertFrom-Json).Count`, so the existing text does not
cover it.

**The cure, measured:** pass the string as an ARGUMENT — `(ConvertFrom-Json $raw).Count` — or read
the raw `--json` text and look for `[]`. Never wrap a piped `ConvertFrom-Json` in `@()` and count it.

**FINDING F5 — `@(<json> | ConvertFrom-Json).Count` returns 1 for every input, empty or not.**
**DISPATCHED → Station 06**, to be folded into the SAME doc-reconcile prompt as 04's four §9 drift
findings rather than opening a second one. It belongs in `§9.4 GitHub` next to assign-then-foreach.
That block is the hash-gated `instruments v2` canonical block, so the prompt must run
`lint-station.mjs --write-canonical` in the same PR — already stated in that dispatch.

**How it was caught, because the method is the point:** the count `1` was not obviously wrong. It
became obviously wrong the moment the same query ran against a case whose answer I already knew
(3 merged PRs) and returned `1` again. That is DOCTRINE §7 guard 1 — *prove the check CAN pass
before believing it* — and §9.6, *an empty result is not an empty world*. The board reading in this
report's WHAT I MEASURED section comes from `status-sweep.ps1`'s own `OPEN PRs: 0` and from the raw
`[]`, not from the collapsing form.
