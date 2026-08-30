# Station 04 — Scanner | 2026-08-29T10:10Z–2026-08-29T10:19Z

## GROUND

```
UTC            2026-08-29T10:10:48Z
origin/main    d2a0ad4a            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 1501d09c     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Versions agree — full authority, not read-only.

Sweep this run: **`gate-liveness`** (`node scripts/pipeline/next-sweep.mjs` →
`rotation position 1 of 4; previous run 2026-08-29T06:10:57Z`). Rotation advanced at the end of
this run; `docs/pipeline/sweep-rotation.json` is modified and must be committed **with** this file.

## WHAT I MEASURED

**Reachability.** `start_process` shell `powershell.exe` → PID 21668. Not blind. `[MEASURED]`

**Binaries resolve** (§9.5 — an ADMIT obtained without `git` silently waives every
`origin/main:` file gate): `git` = `C:\Program Files\Git\cmd\git.exe`, `gh` =
`C:\Program Files\GitHub CLI\gh.exe`, `node` = `C:\Program Files\nodejs\node.exe`. `[MEASURED]`
Control pair on the `git` probe the linter actually uses: `git cat-file -e origin/main:docs/pipeline/DOCTRINE.md`
→ exit 0; the same command against a path that does not exist → exit **128** with a real
`fatal: path ... does not exist in 'origin/main'` on stderr. The instrument answers both ways. `[MEASURED]`

**Sweep.** `scripts\pipeline\status-sweep.ps1` @10:11:02Z → section 0 both positive controls
`[LIVE]`, section 7 **`SAFE TO ACT`**. OPEN PRs **0**, armed **0**, needs-marco 14, no-pr-opened 107,
failed 41, watcher node RUNNING pid 26364, main CI 3/3 green. `[MEASURED]`

**Board trap (tracked `*-ready.md` at depth 1 on `origin/main`).**
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/` filtered to
`^docs/pr-prompts/[^/]+-ready\.md$` → **0**. Positive control on the same query, same depth,
`-HOLD.md` → **83**. The zero is a real zero, not a blind query (§9.2). **Board trap CLEAN.** `[MEASURED]`

**The sweep proper.** Harness `C:\po-sup-fix-scripts\gate-liveness-04-2026-08-29-1010.mjs`
(read-only; writes nothing to the repo). It imports `runGate` / `selfTest` from the repo's own
`scripts/pipeline/gate-eval.mjs` rather than re-implementing exit-code handling, parses each
prompt's front matter **without collapsing block scalars** (the `parseFrontMatter` defect in
`lint-prompt.mjs` reported 08-28T10:10Z would have hidden multi-line premises), and evaluates,
for all **84** `-HOLD.md`/`-ready.md` at queue depth 1:

- `requires_merged: N` → `gh pr view N --json state` (cached; OPEN only when `MERGED`)
- `requires_file_on_main: p` → `git cat-file -e origin/main:p`
- `requires_on_main: p [:: needle]` → `git show origin/main:p`, substring test
- `premise` → `runGate(cmd, C:\ProjectOperations2)`; **PASS = work still needed, FAIL = already done**

Five controls, all as expected before any reading was believed: `[MEASURED]`

```
CONTROL gate-eval selfTest: PASS -- positive+negative controls both behaved
CONTROL fileOnMain(DOCTRINE.md)=true (expect true)
CONTROL fileOnMain(zz-nope.md)=false (expect false)
CONTROL needleOnMain(DOCTRINE::SHARED DOCTRINE)=true (expect true)
CONTROL needleOnMain(DOCTRINE::zzz...)=false (expect false)
CONTROL prState(1390)={"state":"MERGED",...} (expect MERGED)
SHA=d2a0ad4aa0f9408980fff9fa6ca3c38047e3c6f1
```

Result across 84 prompts: **0 BROKEN**, 32 ungated, 27 gate-shut, 25 gate-open.
**23 premises DEAD**, 11 gate-open **and** premise-alive. `[MEASURED]`

**Dead-gate hunt (the repair half of this sweep).** Zero `requires_merged` gates name a
CLOSED or UNREADABLE PR. Exactly one gate could not even find its file —
`pr-sor-s9b-register-ui-HOLD` on
`apps/api/src/modules/agreed-records/agreed-record-register.controller.ts :: eligible-for-claim`,
absent from `origin/main` entirely. **It is not dead:** the live predecessor
`pr-sor-s9a-register-api-HOLD.md` creates that controller (the monolithic `pr-sor-s9` was split
into s9a+s9b and retired to `superseded/` on 08-24). Checked, negative. **ZERO dead gates** —
replicating the 08-27T10:10Z reading with a different instrument. `[MEASURED]`

**No masking.** All 23 dead premises sit behind gates that are OPEN (14) or absent (9). Not one
dead premise is hidden behind a shut gate, so no gate repair could have changed a premise reading
this run. `[MEASURED]`

## WHAT CHANGED

**Nothing on the board.** No file staged, armed, renamed, moved or deleted; no prompt edited;
no `git` write. `git diff --cached --name-status` → **0 lines**, before and after (the dev-tree
index is shared; it was clean and I left it clean). Two artifacts written outside the queue:
this breadcrumb, and the harness + its output under `C:\po-sup-fix-scripts\` (scratch, untracked,
outside the repo). `docs/pipeline/sweep-rotation.json` advanced 1→2 per the station doc. `[MEASURED]`

## FINDINGS

### F1 — 23 of 84 root HOLDs are SPENT, and this is the THIRD run to say so. Nothing has moved. `[MEASURED]`

The same finding was filed on 2026-08-27T10:10Z (21, by lint exit-3 census) and again on
2026-08-28T18:10Z (21, by executing premises — F2, **DISPATCHED → Station 00**, with all 21 named).
That breadcrumb landed on main in **#1385**, so Station 00 could read it. **Eight Station 00 runs
have executed since** (20:09, 22:09, 00:08, 02:08, 04:08, 06:08, 08:08 …). The proof that nothing
moved is not a mtime — it is the tree:

```
all 23 still tracked at docs/pr-prompts/<name>-HOLD.md on origin/main: 23 of 23
```

The list has now **grown by two**: `pr-lint-armed-gate-inversion-HOLD` (token
`ARMED_GATE_STILL_CHECKED` now ×2 on main) and
`pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD` (`check-breadcrumb` now ×2 in
`docs/pipeline/stations/06-pr-master.md`, landed by #1383). Both are honestly spent.

**Gate SATISFIED + premise DEAD (14)** — `-HOLD.md` each:
`pr-crm-lastmile-s1-unblank-todos-and-notes` · `pr-crm-s2-nav-three-items-tabs` ·
`pr-crm-tender-count-truth` · `pr-crm-wincount-s2-close-bypasses` · `pr-dns-s2-ea-series` ·
`pr-dns-s3-sot06-widgets-and-marker` · `pr-dns-s4-checker-warn-only` ·
`pr-ew-s2b-alloc-engine-core` · `pr-guard-s1-verdict-file-list` ·
`pr-guard-s2-prompt-search-by-branch` · `pr-guard-s3-file-gate-not-released` ·
`pr-lessons-folder-s2-unfold-sot05` · `pr-lessons-folder-s3-ref-checker` ·
`pr-pipeline-fold-s2-merged-page`

**Ungated + premise DEAD (9)**: `pr-breadcrumb-gitignore-gate-routing-not-mention` ·
`pr-ci-windows-pipeline-tests` · `pr-comms-hub-inbox` · `pr-dns-s1-tfm-series` ·
`pr-lint-armed-gate-inversion` · `pr-lint-human-gate-blindness` ·
`pr-queue-bin-guard-orphaned-discharge` · `pr-sot-02-reconcile-2026-08-19` ·
`pr-station-contract-breadcrumb-validator-and-qa-claim`

Four spot-verified **by hand against `origin/main`**, not by exit code alone, because DOCTRINE §7
trap #3 is exactly "premise satisfied → binned the prompt" and these are bin candidates:
`HUMAN_GATE` ×8 · `ARMED_GATE_STILL_CHECKED` ×2 · `ORPHANED_DISCHARGE` ×3 · `GATE_NOT_RELEASED` ×17,
all present in `origin/main:scripts/pipeline/lint-prompt.mjs` (dev-tree counts identical, so the
dev-tree lag cannot be the explanation). The work shipped. `[MEASURED]`

**DISPOSITION: DISPATCHED → Station 00.** Move these 23 to `docs/pr-prompts/superseded/`,
**`git mv`, never delete** — a checkout re-arms a deleted-but-tracked prompt (the board trap).
This cannot fire anything: a `-HOLD.md` matches no watcher glob at any point during the move, so
it is untouched by the standing OAuth "arm nothing" block. Commit **with a pathspec** — the
dev-tree index is shared.

### F2 — the dispatch mechanism itself is what is failing, not the finding. `[INFERRED]`

Three runs, three identical DISPATCH lines, zero movement, and no Station 00 breadcrumb since
08-28T18:10Z records a decision on F2 either way — not "done", not "declined", not "blocked by the
OAuth hold". DOCTRINE §6 forbids exiting silently; a dispatch that is neither actioned nor
refused for four consecutive collector runs is the same failure wearing the collector's hat.
Filing it a fourth time identically would be the loop DOCTRINE §5.6 names.

The most likely reason `[INFERRED]`, offered so 00 can confirm or refute rather than re-derive:
the standing OAuth block reads **ARM NOTHING**, and a queue mutation during a hold looks like it
is covered by that. It is not — see F1.

**DISPOSITION: ESCALATED → Marco.** The question is an authority grant, so it is yours, not 00's.
**RULE 1** applied — *solves it completely, immediately and in future, without damaging existing or
future data entry*:

- **(C) — complete and additive, put first: grant Station 04 the narrow authority to `git mv` a
  premise-dead HOLD into `superseded/`, and nothing else.** 04 already executes the premises, so the
  actor that proves a prompt spent is the one that files it — no hand-off to lose. It is additive:
  `superseded/` is retention, not deletion, and a `-HOLD.md` can arm nothing in transit, so no data
  entry present or future is touched. Both halves pass. Needs a guard that refuses any file whose
  premise did not return a clean non-zero this run.
- **(A) — 00 keeps it, and the collector gains an explicit "dispatch aged > 2 collector runs"
  report line.** Passes the no-damage half. Fails the *complete* half: it fixes the visibility of a
  dropped dispatch, not the dropping — the same list can still sit for another day.
- **(B) — leave it.** Fails both halves. The 23 grow every day; each spent HOLD is a live re-arm
  candidate sitting in the tree, and RULE 4's arming detector has to be read past 23 more files
  every time anyone triages the board.

### F3 — the 11-item arm-candidate list is byte-identical to 16 hours ago. `[MEASURED]`

Gate-open **and** premise-alive: `pr-crm-s3-account-on-client-create` ·
`pr-crm-wincount-s3-recompute` · `pr-dns-s5-checker-flip-to-fail` ·
`pr-e2e-container-s2-swap-required-job` · `pr-ew-s2c-alloc-rejection-path` ·
`pr-fv2-maintenance-usage-intervals` · `pr-pipeline-nodrift-agents-write-sweep-commits` ·
`pr-queue-armed-tracked-detector` · `pr-rates-11b2-resolver-isactive-surface` ·
`pr-rates-consumers-s3-persona-export` · `pr-unified-api-key-vault-slice4c-retire-old-screens`
(all `-HOLD.md`). Same eleven, same order of membership, as the 08-28T18:10Z F3 table.

This is **expected, not a defect**: armed = 0 because the OAuth block correctly holds the agent
lane. Recorded so the next run has a baseline and can tell a held brake from a stalled one.
🔴 `pr-dns-s5-checker-flip-to-fail-HOLD` is on the standing must-NOT-arm list despite satisfying
every mechanical gate — its presence here is not a recommendation.

**DISPOSITION: DEFERRED** — becomes actionable the moment the OAuth block clears; arming is 00's
on Marco's authority, one at a time, and nothing about this list changes that.

### F4 — 04's own staged fix has been sitting untracked for 8 hours. `[MEASURED]`

`docs/pr-prompts/pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` is `??` in the dev tree and **absent from
`origin/main`**. It is the fix for the measured DOCTRINE §9.5 defect (the silent gate waiver is
`git`, not `gh`) staged by the 08-29T02:11Z run. It is the **only** depth-1 HOLD on disk that is not
tracked (84 on disk, 83 on main; the diff is exactly this file), so anything reading the board from
`origin/main` — including a fresh clone and the watcher — cannot see it at all.

Control on the same query: the nine station breadcrumbs that also show `??` in the dev tree are all
**tracked on `origin/main`** (they landed in #1388/#1389 after the dev tree's HEAD), so `??` alone
is not evidence of an orphan. Only this file and `pr-doctrine-s9-four-false-traps-LOOPING.md`
(a `-LOOPING` suffix matches no glob and is inert by design) are genuinely off main. `[MEASURED]`

**DISPOSITION: DISPATCHED → Station 00.** Commit it with the next board PR, alongside this
breadcrumb and `sweep-rotation.json`. It is a `-HOLD`, so landing it arms nothing.

## WHAT I DID NOT DO

- **Moved nothing.** 04 is READ-ONLY on the board; F1 is 00's to execute even though 04 is the
  station that proved it. That gap is exactly what F2 escalates.
- **Armed nothing, staged no new prompt.** The standing OAuth block says arm nothing, and adding a
  22nd un-landed staged prompt to a queue whose problem is that staged work does not land would be
  self-defeating. F4 is the evidence.
- **Did not re-lint the board.** The 30/30/21 lint census stands; this sweep executed premises with
  an independent instrument instead, which is why its agreement with the census is worth anything.
- **Did not run `status-sweep.ps1` §3b ENSURE-UP** or any watcher repair — 03's lane, and §3b is
  recorded dead code that would start a fourth launcher.
- **Did not re-raise** the OAuth expiry, the watcher-clone fast-forward ownership, the five stale
  `Scheduled\*\SKILL.md` bootstraps, `no-pr-opened/` being unignored, or the four findings dispatched
  on 08-27T22:10Z. All are open, all are already filed, none changed this run.
- **Did not touch Azure / Entra / SharePoint, production data, or `/sot/`.**
