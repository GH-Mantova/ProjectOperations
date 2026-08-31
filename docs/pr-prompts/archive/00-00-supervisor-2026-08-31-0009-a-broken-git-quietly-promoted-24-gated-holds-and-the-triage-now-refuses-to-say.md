# Station 00 — Supervisor | 2026-08-31T00:08Z–2026-08-31T00:5xZ

## GROUND

```
UTC            2026-08-31T00:08:59Z
origin/main    b19f3db9            (git fetch origin, then rev-parse --short origin/main
                                    = b19f3db9a39ce8f3065dd009c0a0d2dc0fb58bb8)
dev tree       main @ b19f3db9      C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not downgraded to read-only.

**SIGHTED.** `start_process` shell `powershell.exe` returned `PROBE-OK 2026-08-31T10:08:41+10:00`
on the first call. Every `[MEASURED]` line below came off the box.

Binding-doc freshness: dev HEAD == `origin/main` == `b19f3db9`, and none of `DOCTRINE.md`,
`STATION-CAPABILITIES.md` or `stations/00-supervisor.md` appears in `git status --porcelain`, so the
working copies are byte-identical to `origin/main`. All three were read **in full** this run.

`status-sweep.ps1` @00:09:15Z: section 0 positive controls both `[LIVE]` (gh saw merged #1411; node
runs). Section 7 verdict **SAFE TO ACT**.

---

## WHAT I MEASURED

**Board.** [MEASURED] OPEN 1 — **#1412** `feat(crm-s4): review-and-link preview screen`,
`mergeStateStatus=BLOCKED`, `isDraft=false`, `autoMergeRequest=null`, labels `do-not-merge`.
Checks: 12 pass / 0 fail / 1 pending (`tendering-e2e`). Main CI last 3 runs 3 success.

**#1412 is Marco's — BOTH gates fire.** [MEASURED]
```
processed\pr-crm-s4-review-and-link-preview-ready.md.log
  [watcher] merge result for PR #1412: {"ok":false,"marco":true,
            "reason":"escalates:true - held for Marco, labelled do-not-merge"}
POSITIVE CONTROL, same probe on the crm-s3 log (known marco:true)
  [watcher] merge result for PR #1409: {"ok":false,"marco":true, ...}
```
The control fired, so the empty case would have meant something. It did not arise: #1412 carries the
watcher routing **and** the `do-not-merge` label. RULE 2 binds. I did not merge it, did not enable
auto-merge on it, and did not touch its label.

**Queue.** [MEASURED] armed `*-ready.md` **0** at 00:2xZ (`rev-1412-ready.md` had self-armed and been
consumed since the sweep's 00:09Z reading — re-counted by hand, not quoted from the sweep).
HOLD **60** → **59** after this run's arm. `needs-marco/` 14 · `no-pr-opened/` 107 · `failed/` 41 ·
`blocked/` 3. Newest `failed/` entries are still the 08-29 07:03 OAuth 401s — nothing has failed on
auth since Marco re-authed.

**Breadcrumbs.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
`structure: 21 checked, 0 malformed`, freshness `00 2.0h/2 · 02 dispatch-only · 03 1.2h/24 ·
04 2.0h/4 · 05 10.0h/24`, **CLEAN exit 0**. Station **06 still has no cadence key at all** and does
not appear — the standing gap, unchanged.

**Watcher.** [MEASURED, from the sweep] node **pid 6388**, wrapper **1**, heartbeat 1 min,
orphaned worktrees none, guard hook present. I did not restart it and had no verdict that would
license it.

**Concurrent actor — LIVE, and new since 03's 23:01Z reading.** [MEASURED]
```
git worktree list
  C:/ProjectOperations2    b19f3db9 [main]
  C:/po-worktrees/s4-fix   b4b88573 [s4-fix-local]     <- not present at 23:01Z
  C:/po-worktrees/sup-0031 b19f3db9 [chore/board-...]  <- mine
C:/po-worktrees/s4-fix: 3 modified files under apps/web/src/pages/crm/ (AccountLinkPreview*)
  HEAD b4b88573  2026-08-31 09:59:29 +1000  = 2026-08-30T23:59Z — nine minutes before this run
```
Someone is hand-fixing #1412's code right now. It has its own index, so it did not collide with my
dev-tree `git mv`; I re-measured `git diff --cached` immediately before and after arming and it
carried only my own rename.

**Arm candidate, re-verified at `b19f3db9` before arming.** [MEASURED]
```
git --version           2.55.0.windows.3        LINT_GIT_BIN unset
git show origin/main:docs/pipeline/DOCTRINE.md  419 lines   <- DOCTRINE 9.5 precondition
node lint-prompt.mjs pr-lint-frontmatter-block-scalar-collapse-HOLD.md   ADMIT   exit 0
node lint-prompt.mjs pr-dns-s5-checker-flip-to-fail-HOLD.md              REJECT  exit 1  (control)
premise  `! grep -q foldBlockScalar`  -> 0 hits on origin/main            TRUE
positive control  parseFrontMatter    -> 5 hits                           instrument works
union grep for don't-arm markers, case-sensitive:  candidate CLEAN
positive control pr-524-rates-b-slice2-canonical-HOLD.md: fired, L27 "DO NOT ARM YET"
front matter read by eye: gate_allow none · escalates false · backfill false · size 2 ·
  no requires_* · rollback_strategy is an INLINE quoted scalar, not a block scalar
```

**04 FINDING 2, re-measured independently at `b19f3db9` before I edited DOCTRINE.** [MEASURED]
```
ls-tree     -- 'docs/pr-prompts/superseded/*.md'   -> 0
ls-tree -r  -- 'docs/pr-prompts/superseded/*.md'   -> 0      (doc claimed 247)
ls-tree -r  -- 'docs/pr-prompts/*.md'  POSITIVE CONTROL -> 0, against a truth of 85   <- CONTROL FAILS
ls-tree     -- docs/pr-prompts/superseded          -> 1
ls-tree -r  -- docs/pr-prompts/superseded          -> 252
ls-tree -r  -- ':(glob)docs/pr-prompts/superseded/**/*.md'
              fatal: pathspec magic not supported by this command: 'glob'
```

**04 FINDING 1, reproduced A/B/C on the live board.** See FINDING 1 below for the numbers.

---

## WHAT CHANGED

1. **CURED the live staged half-arm** (04's FINDING 4, recurred). At 00:1xZ the shared dev index
   carried `R100 pr-crm-s4-review-and-link-preview-HOLD.md -> ...-ready.md` with the worktree
   showing `RD` — the rename staged, no file on disk. Applied the standing cure:
   `git restore --staged <HOLD> <ready>` → exit 0. **Read back:** `git diff --cached --name-status`
   **empty**, worktree line now ` D` not `RD`, `armed on disk` still **0**. The prompt was
   legitimately consumed (it is in `processed/`, and #1412 carries the work).
2. **ARMED `pr-lint-frontmatter-block-scalar-collapse-HOLD.md`** by `git mv` of the tracked HOLD.
   **Read back:** armed **0 → 1**, `pr-lint-frontmatter-block-scalar-collapse-ready.md` present on
   disk at 6730 bytes, HOLD gone from disk, and `git diff --cached --name-status` carries **only**
   that one `R100`. One at a time; the slot was free.
3. **Board PR (this one).** `scripts/pipeline/triage-holds.ps1` gains a git positive control and a
   skipped-gate counter (FINDING 1). `docs/pipeline/DOCTRINE.md` §9.2 gets a worked example that
   its own query form can actually produce, plus the missing glob-pathspec rule (FINDING 2), with
   `_canonical-blocks.json` re-recorded via `node scripts/pipeline/lint-station.mjs
   --write-canonical` → `instruments v2 5a2d74b39600c1b5`; `lint-station.mjs` then ADMITs all 7
   docs at exit 0. Collected 03's and 04's untracked breadcrumbs. Committed 04's
   `sweep-rotation.json` advance (`last_index 0 → 1`) so 04 does not repeat instrument-honesty.
   Retired the consumed `pr-crm-s3-account-on-client-create-HOLD.md` (#1409 merged 22:39Z).
   Archived the 18 breadcrumbs earlier runs had already dispositioned.
4. Nothing else. No merge, no label change, no `/sot/` edit, no watcher restart, no production data,
   no Azure/Entra/SharePoint. No `git checkout` / `reset` / `stash` / `clean` anywhere.

---

## FINDINGS

### FINDING 1 — A broken `git` silently promoted 24 gated HOLDs to "candidate" and the triage said "calibrated" both times. Fixed, with the A/B/C proof.

Collected from **04's 2026-08-30T22:10Z breadcrumb, FINDING 1** and reproduced on the live board
before acting. `lint-prompt.mjs` fails **open** with respect to arming: `readFromOriginMain`
(`:439-459`) returns `null` when git is unreachable and all five gate probes skip, so the verdict
line and the exit code are indistinguishable from a real ADMIT.

Measured this run, same board, same minute:

```
A  NEW script, healthy git     TOTALS spent=0 gates-satisfied=30 still-gated=30 of 60   exit 0
                               GIT control: PASS -- git read origin/main:DOCTRINE.md (36132 chars)
                               SPENT control: PASS
B  NEW script, LINT_GIT_BIN=C:\definitely\no\such\git.exe
                               [CANNOT MEASURE] the gate probes cannot run
                               "TOTALS" appears 0 times in the output              exit 2
C  OLD script, same broken git TOTALS spent=0 gates-satisfied=53 still-gated=7  of 60  exit 0
                               calibrated: 2 distinct verdicts observed (ADMIT, REJECT)
```

**C is the defect, verbatim: 23 gated HOLDs change bucket and the calibration line prints the
identical reassurance.** It cannot be caught by `buckets -lt 2`, because the survivors are the
`HUMAN_GATE_PRESENT` rejects matched at `lint-prompt.mjs:728` *before* any git probe runs — so the
one failure mode where the buckets are wholesale wrong is precisely the one that leaves two buckets
populated. Among the prompts C promotes is `pr-rates-s11c-drop-legacy-tables-HOLD`, an irreversible
table drop whose skipped gate is the file recording **Marco's written approval**.

Implemented 04's option **(A)**, which is the complete-and-additive one under RULE 1:

- a **git positive control** before the sweep — it resolves the binary exactly as `lint-prompt.mjs`
  does (`$env:LINT_GIT_BIN ?? "git"`, so testing the linter with a broken bin trips this too),
  proves `git show origin/main:docs/pipeline/DOCTRINE.md` returns bytes, and on failure prints
  `[CANNOT MEASURE]` and exits **2** without printing a single bucket;
- a **skipped-gate counter** for the *partial* outage the preflight cannot see — git resolves but an
  individual `git show` fails, `lint-prompt.mjs` prints `probe: could not reach ...; skipping
  (fail-safe)` and then ADMITs at exit 0. Any such line now suppresses TOTALS and exits 2, naming
  every affected prompt.

**COMPLETE** — catches total and partial outages, now and for every future run, at the layer
stations actually quote. **ADDITIVE** — identical output when git is healthy (A above), blocks no
PR, changes no verdict, mutates nothing; it only ever converts a confident wrong answer into a
refusal to answer. Option (B), a delta alarm, fails COMPLETE (needs persisted prior state and still
ships one bad run); option (C), rely on readers noticing the WARNs, fails COMPLETE outright — the
WARNs scroll past above the line everybody quotes.

**DISPOSITION: ACTIONED** — in this PR, verified by the A/B/C run above.

### FINDING 2 — DOCTRINE §9.2's worked example used a query form `ls-tree` cannot answer, and the real trap is bigger than the one it taught.

Collected from **04's FINDING 2**, re-measured independently at `b19f3db9` with the control (see
WHAT I MEASURED). The parenthetical claimed `superseded/*.md` returned 0 without `-r` and 247 with
it. It returns **0 both ways** — and so does the positive control `docs/pr-prompts/*.md` against a
truth of 85 tracked files. **`git ls-tree` has no glob pathspec at all**: any `*` form returns 0
silently at exit 0, and the only glob form that fails loudly is the explicit `:(glob)` magic, which
errors. A reader who "fixes" a zero-result glob by adding `-r` gets the same zero and now believes
it — inside the very bullet whose job is to prevent that.

Replaced the parenthetical with the directory form that actually produces the contrast (1 without
`-r`, 252 with it, measured today at a named SHA) and added a new bullet stating the glob rule with
its failing control. The headline rule was never wrong; only its illustration was, so the rule is
untouched. `instruments v2` is hash-gated, so `_canonical-blocks.json` is re-recorded in the same
commit (`5a2d74b39600c1b5`) and `lint-station.mjs` ADMITs all 7 docs at exit 0 — the #1401/#1402
shape.

**DISPOSITION: ACTIONED** — in this PR.

### FINDING 3 — 03's F2: the verdict-archive sweep is a closed loop, its fix is on main and unarmed, and it lost the one-at-a-time race to a safety fix.

Collected from **03's 23:01Z breadcrumb, F2**. Every watcher start re-deletes 35 tracked
`docs/pr-reviews/*.md` in the clone; the next start's preflight autostashes them; the stash grows
~3/day and stands at 54. `status-sweep`'s `watcher clone: dirty=37` is that, not a startup risk.
The remedy landed on `main` in #1410 as `pr-watcher-verdict-sweep-skips-tracked-HOLD.md`, and only
Station 00 may arm it.

I did not arm it, and the reason is RULE 4, not doubt about the finding: the single arming slot went
to `pr-lint-frontmatter-block-scalar-collapse`, which repairs the LL-29 rollback gate that currently
reads two characters on **9 live prompts including two irreversible table drops**. Damage prevention
outranks churn prevention. The verdict-sweep loop costs stashes and a misleading amber; the
block-scalar defect rubber-stamps the gate that stands between an agent and a `DROP TABLE`.

**DISPOSITION: DEFERRED** — it is the **next arm**, the moment `armed on disk` reads 0 again with no
concurrent actor mid-mutation. It becomes urgent sooner if the clone's stash count crosses ~70 or if
a station is ever blocked by the clone's dirty state rather than merely warned about it.

### FINDING 4 — 03's F1: the OAuth token expires at 05:17Z today, a `refreshToken` is present, and the headless path still does not use it.

Collected from **03's F1**, and its central claim re-verified this run rather than repeated: the
08-29 401 quarantines are still the newest entries in `failed/`, nothing has failed on auth since
the 21:17Z re-auth, and the watcher has been alive on pid 6388 since 21:25Z. 03 measured
`expiresAt 2026-08-31T05:17:16Z` with a `refreshToken` present, and correlated three watcher deaths
in the 40 minutes before the re-auth against six relaunches in the log's entire history.

This is an authentication-credential path. It is a hard stop for every station including me
(DOCTRINE §5.3/§5.4, CAPABILITIES §8), so I am carrying 03's question forward unchanged rather than
building anything. **Next expiry is 05:17Z = 15:17 Brisbane, a working-day afternoon**, and the
00-supervisor run at 06:07Z falls outside the token.

RULE 1 options, complete-and-additive first, as 03 framed them:

- **(a) Make the headless path exercise the `refreshToken` it already has.** Complete (fixes today's
  expiry and every future one) and additive (it only writes a fresher token into a file that is
  rewritten on every re-auth). **Marco's question, and it is a real fork:** should this be a
  pre-run refresh in `watcher-launcher-singlelane.ps1`, or is the CLI meant to refresh itself and
  the actual bug is that it cannot under a detached, hidden-window context? Those are two different
  fixes and only you know which behaviour you intended.
- **(b) Alarm on it** — log `hours left` each keepalive tick and shout under a threshold. Additive,
  damages nothing, but fails the *immediately-and-future* half: Marco still re-auths by hand daily.
- **(c) Re-auth before 15:17Z and look again tomorrow.** Fails the *future* half outright.

**DISPOSITION: ESCALATED** — to Marco, question (a) above.

### FINDING 5 — A consumed prompt leaves a staged `RD` in the shared dev index every single time, and the cure lives only in agents' memory.

04's FINDING 4 recorded this on 2026-08-30, watched it self-clear inside 7.5 minutes, and DEFERRED
it with the trigger *"the moment `git status --porcelain` shows an `RD` under `docs/pr-prompts/`."*
**That trigger fired 1h50m later**, on a different prompt: `pr-crm-s4-review-and-link-preview` left
exactly the same `R100`/`RD` pair after the watcher consumed it. I cured it (WHAT CHANGED 1).

So this is not an incident, it is the **steady state**: every consumed prompt opens a window in
which one pathspec-less commit by any chat or station publishes an armed prompt to `main` with no
file behind it. Two occurrences in two days is the measured rate, and both were cleared by hand with
nothing recorded about who did it — 04 could not identify who cleared the first one.

RULE 1 options, complete-and-additive first:

- **(A) Have `status-sweep.ps1` check for it by name.** Section 3 already reads the dev index for
  `index.lock`; add a check that greps `git status --porcelain -- docs/pr-prompts` for `^RD` and
  prints the file pair plus the exact `git restore --staged` cure, as a CAUTION rather than a
  DO-NOT-ACT. Complete (every station runs the sweep every run, so the window can no longer close
  unobserved, and the cure travels with the detection instead of living in one agent's memory) and
  additive (a read-only grep in a read-only report; blocks nothing, changes no verdict).
- **(B) Have the watcher `git restore --staged` after it consumes a prompt.** Closes the window at
  source, but fails the *without damaging existing data entry* half: it makes the watcher write to
  the shared dev index, which is the LL-38 collision shape, and a mistimed restore could unstage
  another chat's legitimate work.
- **(C) Leave it in memory.** Fails COMPLETE — it has now been hand-cured twice with no trace, and
  the memory that carries it is not readable by 03, 04 or 05.

**DISPOSITION: DISPATCHED → Station 06**, to stage (A) as a prompt against `status-sweep.ps1`.
⚠️ **And I am flagging that dispatch as itself unreliable:** 06 has no cadence key in
`check-breadcrumb.mjs` and no schedule, so "DISPATCHED → 06" parks rather than closes, and no
instrument counts the park. That is the standing open question below.

### FINDING 6 — "DISPATCHED → 06" still parks, and `--freshness` still cannot see it.

Unchanged from earlier runs and re-confirmed this run: `CADENCE` at `check-breadcrumb.mjs:36` has no
`'06'` key at all — not `null` like `'02'`, simply absent — so 06 never reads `ok`, never reads
`SILENT`, and never appears in `--freshness` output (verified again this run: the freshness block
lists 00, 02, 03, 04, 05 and nothing else, at exit 0). Every dispatch to 06, including FINDING 5's,
lands in a lane with no cadence, no deadline and no instrument.

The two halves are **inseparable**: `'06': <n>` *without* a real scheduled task makes `SILENT` →
`process.exit(2)` at `:224` fire on every station's preflight forever, while `'06': null` prints
*"dispatch-only — no cadence to miss"*, which is true of 02 and false of 06 — replacing invisible
parking with a false reassurance. Creating the scheduled task is Marco's box.

**DISPOSITION: ESCALATED** — to Marco, unchanged: **(A)** give 06 a schedule *and* a cadence key,
together, so dispatches to it close; **(B)** 00 actions 06's items itself, which fails COMPLETE
because it puts staging work in the arming lane; **(C)** leave it, which fails COMPLETE outright —
it is how a defect named in a breadcrumb filename on 08-26 was still live three days later.

---

## WHAT I DID NOT DO

- **Did not merge, label, or enable auto-merge on #1412.** Both of the two independent gates fire on
  it (watcher `"marco":true` with the control proving the probe works, and the `do-not-merge`
  label). RULE 2 and CAPABILITIES §5 both bind. Its last pending check is `tendering-e2e`; a
  concurrent actor is hand-fixing its code in `C:\po-worktrees\s4-fix` as of 23:59Z, so I left the
  branch alone entirely rather than pushing into someone else's work (LL-38).
- **Did not commit the dev tree's ` D pr-crm-s4-review-and-link-preview-HOLD.md`.** #1412 is open and
  Marco's; if he declines it, committing that deletion erases a live chain prompt from `main`. It
  becomes free the moment #1412 merges or closes — the same discipline 03's F4 correctly retired for
  crm-s3, which I *did* commit this run because #1409 landed.
- **Did not arm a second prompt.** RULE 4 is one at a time.
- **Did not restart the watcher, clear a lock, drop a stash, or fast-forward the clone.** No verdict
  licensed any of it: node 6388 alive with one wrapper, heartbeat 1 min, no locks anywhere, and 03
  measured that none of the clone's 32 commits of drift touches `scripts/pr-watcher/**`, so a
  restart would buy nothing and cost a crash window plus an autostash.
- **Did not touch `docs/data-model/metadata-catalog.json`**, which shows ` M` in the dev tree.
  `git diff --stat` on it returns nothing but a CRLF warning — the change is line endings only, it
  is not mine, and I do not know who is mid-edit on it.
- **Did not triage `no-pr-opened/` (107), `failed/` (41) or the 14 `needs-marco/` escalations**,
  including the 13 the sweep marks `[STALE]` against merged or closed PRs. That backlog wants one
  dedicated pass, not a slice at the end of a run, and nothing on it is blocking the board today.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, or any production data,** and read no
  credential value — FINDING 4 rests on 03's reading of field names and one expiry integer.
- **Did not run `smoke-pr.ps1`.** The only open PR is one I may not merge.
