# Station 00 — Supervisor | 2026-09-22T19:52Z–2026-09-22T20:20Z

## GROUND

```
UTC            2026-09-22T19:52:51Z
origin/main    efe341b1  ->  a9ee8740   (fetched first, then rev-parse; moved by this run's own merge)
dev tree       main @ 25aa3115          C:\ProjectOperations2   (2 behind at open — this matters, see F1)
doc version    1                        (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                        (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE** — this run was not forced read-only by a version mismatch.

**Sighted run.** Desktop Commander loaded via keyword `ToolSearch` (never a hard-coded `select:` of
tool ids), and `start_process` shell `powershell.exe` answered on the first call:
`git rev-parse --abbrev-ref HEAD` → `main`, `git log -1` → `25aa3115`. A blind run and a healthy
quiet run both produce "no news"; **this was the healthy one.**

**Freshness proved, not assumed.** `git diff --numstat origin/main --` over
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY** on all three, so reading the working copy was
sound even though the tree was 2 behind. Read this run: `00-supervisor.md` in full (1449 lines),
`DOCTRINE.md` §1–§10.2.1, `STATION-CAPABILITIES.md` §5–§6.

**vm-git-guard**, installed before any VM-side call:
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — headline
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`,
last line `PATH="/sessions/festive-elegant-dijkstra/.local/bin:$PATH" git <args>`,
**installer exit code 2**, read from the installer itself and not from a pipeline appended to it.
That is the middle outcome the contract names as EXPECTED for a station — a FINDING, not a STOP.
**No `git` was run against the mount at any point**; every git call went through the Windows shell.

## WHAT I MEASURED

### The board

[MEASURED] `gh pr list --state open` at 19:53Z → **2 open, ZERO DIRTY.** Neither PR has frozen CI.

| PR | mergeState | CI | lane | disposition |
|---|---|---|---|---|
| #2095 `docs(pr-prompts): retire e2e-container slice 2` | CLEAN | 10 pass / 0 fail | second lane, docs-only | **MERGED by me** |
| #2093 `feat(tendering): scopecards S7 — one cutting total` | BEHIND | 12 pass / 2 fail / 1 pending | second lane, `apps/api` + 3 migrations | **Marco's** |

[MEASURED] **Lane probe (§10.1 step 1), pinned to the DEV TREE** — `C:\ProjectOperations2\docs\pr-prompts\processed`,
never the clone (§9.5: the clone holds a 17-day-stale decoy that passes the mandated positive
control). 2378 logs, **941** prompt logs after excluding `rev-*` (§9.5 discriminator (b)),
**699** carrying `marco.:true`, newest log `2026-09-22T19:49:08Z` — younger than both open PRs, which
is the only control that separates the live directory from the corpse. `PR #2095` → **0**,
`PR #2093` → **0**; NEGATIVE controls: a needle minted for this run → **0**, `PR #999999` → **0**.
POSITIVE control that `NO LOG` is a real absence and not a broken probe: the corpus carries real
verdicts, newest `#2071 {"ok":false,"marco":true,…}` at `2026-09-22T02:43:32Z`.
**Both PRs are second lane. Recorded as `[NO LANE VERDICT — hand-classified]`.**

- **#2095** — one file, `docs/pr-prompts/superseded/pr-e2e-container-s2-swap-required-job-HOLD.md`.
  Inside `^(tests|docs)/` **and** inside 00's recorded `docs/` lane (§10.1 step 3 → the
  `STATION-CAPABILITIES.md` §5 matrix). Reviewer verdict `VERDICT: MERGE`. Merged.
- **#2093** — `apps/api/**` plus **three Prisma migrations**. Outside `tests|docs` and outside 00's
  lane, and migrations fail `classifyPolicyFiles` on their own clause. **Marco's, twice over**, and
  it also carries `do-not-merge`. Not merged, not rebased.

[MEASURED] **#2093's two reds are one cause and are PARKED BY DESIGN.** Read from column 3 of the
CP-26 job log per §9.1, never from the pass/fail counts:
`FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).`
`[LABEL_PRESENT]` = parked, no agent-side action. The same check runs twice (as the required check
and as a step inside `PR gates`), which is why one cause shows as two reds.

### Queue and arming

[MEASURED] Counted myself, not quoted from a note: `*-ready.md` at depth 1 → **0**;
`*-HOLD.md` at depth 1 → **16**. Every one of the 16 re-linted this run with
`lint-prompt.mjs`, NEGATIVE control (`CLAUDE.md`) → `REJECT [NO_FRONT_MATTER]` exit 1:

| verdict | count |
|---|---|
| `HUMAN_GATE_PRESENT` | 11 |
| `GATE_NOT_RELEASED` | 4 |
| **ADMIT** | **1** — `pr-scopecards-s7-one-cutting-total-HOLD.md` |

**The single ADMIT is not armable, for two independent reasons, and either alone settles it.**
(1) Its body carries a **prose** gate — `STATUS: Staged HOLD … Arming is Marco's` — which
§9.5 records as invisible to the linter and to any grep built on it; ADMIT is necessary, never
sufficient. (2) Its work is **already open as #2093**, so arming it would build a duplicate — the
station doc's own already-SHIPPED check fires on its own. **An empty board is the designed state,
and that is re-measured live this run rather than inherited from the three prior runs that said so.**

### The 17:25Z silent no-op — read, not waved away

[MEASURED] `no-pr-opened/pr-scopecards-s7-one-cutting-total-b-ready.md.log`, exit 0 after 23s, no PR.
The real reason, in the agent's own words: it identified the S7 prompt, read
``marked `STATUS: Staged HOLD ... Arming is Marco's` `` and wrote *"I won't dispatch it without your
say-so. What would you like to do?"* — **it asked a question in a headless run** (§6). This is not a
new defect: my own 17:25Z run armed that prose-gated prompt and its breadcrumb records that the
code-writer caught what it did not. **The prompt is still valid and still Marco's.** The no-op is
correct refusal wearing a failure's clothes, and the prompt was NOT re-armed.

### Machinery

[MEASURED] `status-sweep.ps1`, section 0 instrument controls both PASS (`gh` reached GitHub,
`node` runs) — **no `[BROKEN]`, so the report is usable.** Watcher node **RUNNING pid 9744**,
auto-restart wrapper **alive (1)**, heartbeat **6 min**. `index.lock` interactive/clone **False/False**,
git processes touching our trees **0**. **Not wedged, not down — no restart, no `-Fix`.**
Section 5 carried **no PR-scoped `[STALE]` escalation row**, so there was nothing to discharge.

[MEASURED] `check-breadcrumb.mjs --freshness` → **CLEAN, exit 0.** No station SILENT:
00 `0.5h/1h` · 03 `20.8h/24h` · 04 `1.7h/4h` · 05 `5.5h/24h`.

## WHAT CHANGED

- **#2095 MERGED** via `Assert-SmokedOrEscalate` → `Merge-Pr` (never by hand). Gate returned
  `[true,true]`. **Read back from the remote, not asserted:** `state=MERGED`,
  `mergedAt=2026-09-22T20:00:38Z`, `mergeCommit=a9ee8740…`, and `git rev-parse origin/main` →
  **`a9ee8740`** — it is on `main`, not merely auto-merge-enabled.
- **`git fetch origin --prune` in the dev tree** — 111 stale tracking refs deleted (F2).
- **`docs/pipeline/DOCTRINE.md`** §9.4 — 04's dispatched F2 correction (7 insertions, 2 deletions).
- **`docs/pipeline/stations/00-supervisor.md`** — the tracked-set cure corrected (23 insertions, 0
  deletions), F1.
- **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` hash re-recorded via
  `lint-station.mjs --write-canonical`, **1 line changed**; `station-contract v5` was already
  correct, so no unrelated drift was masked. `lint-station.mjs` then **ADMIT: all 8 docs clean**.
- Prior breadcrumb `00-00-supervisor-2026-09-22-1725-…md` `git mv`'d to `archive/`.
- This breadcrumb, written **inside this run's PR worktree** (REPORT CONTRACT cure 1), so no loose
  copy is left in the dev tree to block the next fast-forward.
- **Nothing armed, disarmed, renamed or retired. No `/sot/` file touched. No Azure / Entra /
  SharePoint contact of any kind.**

## FINDINGS

### F1 — the tracked-set cure asks the DEV TREE, which is behind, so it answers "unreported" about a breadcrumb the previous run already landed

`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`

[MEASURED] Dev tree `25aa3115`, `origin/main` `a9ee8740` (2 ahead). The station doc's own cure for
the 2026-09-07 duplicate-breadcrumb incident says *"Before committing any breadcrumb as unreported,
ask the TRACKED SET, not the dev tree — `git ls-files docs/pr-prompts`."* I ran exactly that:

| probe | result |
|---|---|
| `git ls-files docs/pr-prompts` \| match `00-04-scanner-2026-09-22-1810` — **in the dev tree** | **no row** |
| POSITIVE control, same command, `00-00-supervisor-2026-09-22` | **18 rows** — the probe works |
| the same file in a worktree checked out **at `origin/main`** | ` M`, **not `??`** — it is TRACKED |
| `git diff --numstat` against `origin/main` for it | **EMPTY** — byte-content identical |
| same pair for `docs/pipeline/sweep-rotation.json` (04's advance) | **EMPTY** — already landed |

**Both artifacts had been landed an hour earlier by `#2096`.** The probe was working perfectly and
its answer was still wrong, because `git ls-files` reads the **index of a tree that is behind** —
§9.2's *"on a tree that is behind `origin/main`, `git status` answers a question about `HEAD`"*,
reached through `ls-files` instead of `status`.

🔴 **The available conclusion was the one that section exists to prevent** — *"this station's finding
reached nobody"* — and acting on it commits a **second tracked copy at the root path**, which is the
2026-09-07 duplicate itself, manufactured by its own cure. I had already copied both files into the
PR worktree before the worktree's ` M` (rather than `??`) disagreed with the dev tree and I looked.
Both were restored byte-exact from `HEAD` with a raw-Buffer write — never `git checkout -- <path>`
(§9.2) — and dropped from this PR.

🔧 Landed: ask `origin/main` explicitly —
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash **and** `-r`, §9.2),
matched by basename. That is the same set `check-breadcrumb.mjs` builds, so the two agree by
construction. Falsifying probe written into the doc.

**ACTIONED** — landed in `00-supervisor.md` this run; `lint-station.mjs` ADMIT, byte-delta asserted
equal to the intended delta (1992 = 1992), `--numstat` `23 0` (no whole-file rewrite).

### F2 — Station 04's F3: the remote-tracking cache over-reported the remote 9.2×; pruned, and the residue is exactly what §9.2 predicts

[MEASURED] 04 reported `git branch -r` **147** against `git ls-remote --heads origin` **16**. I ran
`git fetch origin --prune` in the dev tree (a shared-tree mutation, which is why it was 00's call and
not 04's) — **111 stale refs deleted.** Re-measured with a working negative control
(`refs/remotes/zzQq00NoSuchRemote20260922` → 0):

| measure | before | after | truth |
|---|---|---|---|
| `git ls-remote --heads origin` | 16 | **16** | 16 |
| `refs/remotes/*` total | 147 | **40** | — |
| `refs/remotes/origin/*` | — | **17** | 16 heads + `origin/HEAD` ✅ |
| `refs/remotes/<other>` — no refspec owns these | — | **23** | prune can never remove them |

The 23 are 14 × `refs/remotes/pr/<n>`, `refs/remotes/pr1273`, and **9 × `refs/remotes/staleprobe/*`**.
§9.2 records the `pr/N` class; **`staleprobe/*` is not recorded anywhere and is new**. The doctrine
bullet is confirmed exactly: *"`--prune` DOES NOT CURE IT — a pruned cache is still not
authoritative"* — 40 against a truth of 16. **Ask the remote, pruned or not.**

**ACTIONED** (the prune, read back above). The 23 orphan refs are **DEFERRED**: deleting them is a
further shared-tree mutation that buys nothing, because the standing cure is to ask the remote and
that is unchanged. What would make it urgent: the count climbing, or a run enumerating branches from
`branch -r` and filing a stranded-branch finding off it.

### F3 — Station 04's F7 is REFUTED: there is no 12-line reader cap, and §9.1 gains no third shape

04 measured `read_process_output` returning `[Reading 12 new lines (total: 12 lines)]` twice with its
chain's final marker absent, and dispatched to me the question of whether §9.1 needs a third shape —
*"a drained buffer can be CAPPED"*. **It does not.** [MEASURED] with a fixture whose truth is known
by construction (40 numbered lines then a literal `MARKER_F7_DONE`, PID 20124):

| probe | result |
|---|---|
| `start_process` initial read | **all 41 lines**, marker present |
| `read_process_output` drain of the same PID | **`[Reading 42 new lines (total: 42 lines)]`**, marker present, exit 0 |

A cap at 12 cannot return 42. 04's reading was the buffer genuinely holding 12 lines **at that
moment** — i.e. §9.1's existing *"streamed output can return EARLY with output still pending"*
bullet, whose cure (keep draining until `0 remaining`) is already written down and is what 04's own
workaround amounted to. **Nothing is added to §9.1 and nothing is retired.**

**ACTIONED** — the dispatched question is answered and closed. 04's caution was right: it declined to
file a refutation from one unreproduced instance, which is why this cost one fixture instead of a
retired bullet.

### F4 — Station 04's F2: §9.4's escaped-`--jq` arrival string had drifted from the measurement

04 measured `join(\",\")` arriving as `join(",\)` (first double quote surviving) with
`invalid escape sequence "\)" in string literal`, against a doctrine illustration reading `join(,\)`.
The **headline rule was confirmed both times** — escaped double quotes fail LOUDLY, and the plain
single-quoted form returned a correct label reading. Only the illustration was stale, and a reader
hunting the literal `join(,\)` could read its absence as a non-reproduction.

**ACTIONED** — landed in `DOCTRINE.md` §9.4 this run, recording both arrival strings and marking the
string as illustration. Canonical `instruments` hash re-recorded deliberately;
`lint-station.mjs` → ADMIT all 8.

### F5 — the watcher clone is dirty with 5 untracked files, two of which are unpublished review verdicts

[MEASURED] `git -C C:\po-watcher\ProjectOperations status --porcelain` → 5 rows, **all `??`**, none
modified-tracked: `.codex/`, `AGENTS.md`, `scripts/pr-watcher/.conflict-notified-prs.json`, and
**`docs/pr-reviews/pr-2093-review.md` + `pr-2095-review.md`**. The sweep flags this as
*"NOT clean-on-main; the watcher may refuse to start"*. I read both reviews (read-only git in the
clone is sanctioned) and **did not run a single write there** — `checkout`/`commit`/`push`/`merge`
in that repo is absolute.

The review pair matters beyond the dirt: they are the only copies of two verdicts, and one of them
is wrong (F6).

**DISPATCHED to Station 03** — the watcher's local trees are its lane, and the authority matrix gives
00 *Repair the machines: ❌ dispatches 03*. Handing over: the five paths, the fact that all five are
untracked rather than modified, and the question of whether the two `docs/pr-reviews/*.md` should be
published into a PR before the clone is cleaned, since cleaning would destroy them.

### F6 — #2093's reviewer verdict says REJECT-AND-REDO, and its central claim is refuted at the live head

[MEASURED] `docs/pr-reviews/pr-2093-review.md` (untracked, clone-side, **carrying no SHA**) reads
`VERDICT: FIX` / *"REJECT-AND-REDO. API test suite FAILS"*, and names a precise cause: an
`estimates.service.spec.ts` fixture missing `lineTotal`, yielding `Number(undefined)` → NaN → 0.

Re-verified against the live board per §7.1's re-read rule:
**`API — lint, test, compliance smoke` → `pass` (6m20s)** on run `35775947125`, head `d27cd3ac`.
The suite the review says fails is **green**. #2093's only reds are CP-26 and `PR gates`, both
`[LABEL_PRESENT]`, i.e. the label — not the tests.

An artifact with no SHA whose central claim is refuted is a **lead, not a finding** (§7.1), and this
one points at re-firing a prompt for work that is already correct. Its other content — the migration
ordering audit, the Decimal half-up rounding note, and the Wall-elevation behaviour change — is
substantive and unrefuted, and is exactly what Marco needs when he decides on the label.

**ESCALATED** — #2093 is Marco's on both gates (`do-not-merge`, which only he removes; and
`apps/api` + migrations, outside every agent lane). **The question for Marco, not a status update:**
the review recommends REJECT-AND-REDO on a test failure that no longer exists, so —

> **(A) Treat the review as discharged and decide the label on the PR's own live state.** It is
> green but for the label, and `tendering-e2e` was still pending at 20:0xZ. Complete and additive:
> it neither re-runs correct work nor discards the review's substantive risk notes, which stand on
> their own and are quoted above.
> **(B) Re-fire the prompt as the review asks.** Fails the *"without damaging existing/future data
> entry"* half in effort rather than data — it rebuilds a passing branch — and it is also blocked:
> the S7 prompt is prose-gated to you, and the code-writer has already refused it once.
> **(C) Do nothing this cycle.** Fails the *"solves it completely"* half: #2093 is the only open PR
> and the board does not move until the label does.

The one thing only you can decide is item 4 of the review — Walls that were previously unpriced
(rate 0) will now price at ~105.71 under the deepest-at-or-above rule. That is a visible behaviour
change on real estimates and it is a product call, not a CI call.

### F7 — three leftover worktrees, one holding 11 deleted `.claude/` files on an already-merged branch

[MEASURED] `C:/po-wt/dreg` `[fix/d-register-exclude-own-fixtures]`, age 33 min, **dirty=11 — every
row a ` D`**: all eight `.claude/agents/*.md`, `.claude/hooks/guard.mjs`, `.claude/hooks/test-guard.mjs`,
`.claude/settings.json`. That branch is **`#2094`, merged at 19:44Z**, so the worktree is a spent
leftover holding deletions of the agent definitions and the guard hook. `C:/po-wt/retire7` (38 min,
clean) and `C:/po-wt/s7fix` (36 min, detached, clean) are the other two.

**The dev tree is not affected** — the sweep reads `guard hook (.claude/hooks/guard.mjs): present`
[LIVE], and `lint-station.mjs` ADMITs all 8 agent definitions in my worktree off `origin/main`. The
deletions are local to that one worktree. I listed it with `git status --porcelain` before saying
anything about it and **pruned nothing**: `git worktree remove` would refuse, and `--force` would
discard the 11 rows.

**DISPATCHED to Station 03** (local trees, orphaned worktrees, its named lane). Handing over: the
three paths with ages, the 11-row listing, and the fact that `dreg`'s branch is already merged so
the deletions are almost certainly spent rather than work-in-progress — but that is 03's call to
confirm before pruning, not mine to assume.

### F8 — the device-bridge git ban is REMEMBERED, not mechanical, in this run's shell

[MEASURED] `vm-git-guard.sh` exit **2**, headline quoted verbatim in GROUND. Independently
reproduces 04's F1 from 18:1xZ in a different session — its controls, printed by the installer:
`bash -lc 'command -v git'` → the shim, `bash -c 'command -v git'` → `/usr/bin/git`. The shell a
station is given is non-interactive and non-login, so it sources neither `~/.bashrc` nor `~/.profile`.

**DEFERRED** — this is the documented EXPECTED outcome and the contract already says to carry on. No
`git` was run against the mount this run. What would make it urgent: an exit **other than 0 or 2**
(the shim not written at all), or any station reporting a 0-byte `index.lock` with no owning Windows
process, which is the damage the guard exists to prevent.

### F9 — 04's remaining dispositions, closed

- **04 F4** (the long-prescribed negative-control needle still returns hits) — **DEFERRED.** The
  doctrine already prescribes the only cure, mint fresh every run, and both 04 and this run followed
  it. My needle is spent by appearing in this file, which is the rule.
- **04 F5** (`processed/pr-resolve-732-…-ready.md` tracked inside a gitignored folder) — **DEFERRED.**
  Re-measured this run: `*-ready.md` at depth 1 is **0** on disk, so nothing is armed and a checkout
  re-arms nothing. Urgent only if a `*-ready.md` ever appears tracked **at depth 1**.
- **04 F6** (04's own Part 0(a) instrument produced 22 then 1 phantom offenders against a truth of 0)
  — **ACTIONED by 04**, verified in its report: it quoted positive controls (14 super-aware sites, 90
  `can(user, …)` calls) alongside the zero, which is what makes the zero readable. Nothing for me.

## WHAT I DID NOT DO

- **Did not rebase #2093, although it is BEHIND.** The watcher is already driving it and declining
  on purpose: `C:\po-watcher\watcher-launch.log` carries `[update] PR #2095 branch updated (was
  BEHIND)` at 19:50:26Z and then **five** consecutive `[update] PR #2093 is BEHIND but checks in
  flight (tendering-e2e) — not rebasing` through 19:58Z. Rebasing over that is two actors on one
  board, which is LL-38's exact shape. It will update itself when the checks settle.
- **Did not merge #2093**, did not remove or touch its `do-not-merge` label, and did not enable
  auto-merge on it. Only Marco removes that label.
- **Did not arm anything.** One of 16 HOLDs lints ADMIT and it is both prose-gated to Marco and a
  duplicate of open #2093 (measured above). Arming is the decision to run.
- **Did not re-arm the 17:25Z no-op prompt.** Its refusal was correct.
- **Did not restart the watcher**, which is HEALTHY (pid 9744, wrapper alive, heartbeat 6 min).
  Never restart on anything but WEDGED or DOWN.
- **Did not run any git write in `C:\po-watcher\ProjectOperations`** — read-only `status` only.
- **Did not prune the three leftover worktrees** or delete the 23 orphan `refs/remotes/*` refs.
- **Did not commit `docs/pipeline/sweep-rotation.json` or 04's breadcrumb** — both are already on
  `origin/main` (F1). Committing either would have duplicated it. Both restored byte-exact.
- **Did not run §9.5's own instrument sweep** — that is 04's rotation, and its next position is the
  §9.5 remainder 04 named.
- **No Azure / Entra / SharePoint contact of any kind**, read or write.

## FOR MARCO

**One thing needs you, and it is the only thing standing between the board and an empty queue: the
`do-not-merge` label on #2093** (scopecards S7, one cutting total on the server). Only you remove it.

Before you do, two things I would want to know in your position:

1. **The review attached to that PR recommends REJECT-AND-REDO, and its stated reason is no longer
   true.** It says the API test suite fails; the API job passes in 6m20s at the current head. The
   rest of that review is good and unrefuted — read its migration-ordering audit and its rounding
   note. Options are laid out in F6.
2. **The one genuinely product-level call in it:** saw-cut Walls that previously fell through the
   private row-picker and priced at **0** will now resolve under the deepest-at-or-above rule and
   price at roughly **105.71** (the worked example moves from 0 to 264.28). Nothing is corrupted and
   nothing silently changes — rows that were unpriced become priced. But that is visible on real
   estimates, and whether that is the intent is yours, not CI's.

Everything else is healthy: watcher running and supervised, zero dirty PRs, zero armed prompts by
design, all four stations reporting inside cadence, and #2095 merged and on `main`.
