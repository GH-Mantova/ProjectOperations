# Station 00 — Supervisor | 2026-09-22T01:14Z–2026-09-22T01:50Z

## GROUND

```
UTC            2026-09-22T01:14:42Z
origin/main    4d101eea            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 4d101eea     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

**Versions AGREE**, so this run is not read-only. Sighted: Desktop Commander reached the host on the
first call after `ToolSearch`, and every claim below marked `[MEASURED]` was taken through it.

## WHAT I MEASURED

**PREFLIGHT 1 — the device-bridge git guard, last line quoted verbatim, pass or fail:**

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
  -> persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

[MEASURED] It installed and self-certified. ⚠️ **That is not evidence the guard works**, and this run
does not offer it as any: `#2065` is open precisely because the script prints passing controls while
the shim is never on `PATH` in the non-interactive `bash -c` transport a station actually gets. The
line is quoted because the contract requires it to be, and because a run that quotes it and then
claims protection is the failure `#2065` exists to remove.

**PREFLIGHT 2 — the three binding documents were read from a tree PROVED equal to `origin/main`**,
not merely assumed: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**
(§9.1's sound form — no piped hash), and `git rev-list --left-right --count HEAD...origin/main`
returned `0	0`. All three read in full.

**PREFLIGHT 4 — the sweep.** `scripts/pipeline/status-sweep.ps1`, captured with `*>` and decoded
`utf16le` from node (§9.3 — the capture really was UTF-16LE, `FF FE`, 155,964 B / 454 lines).
Section 0 controls both PASS. **Section 7 verdict: `SAFE TO ACT`** — no board mutation in progress,
`index.lock` False in both trees, 0 scoped git processes, no PR touched in the last 2 min.

**Section 5 is CLEAN for the first time in this station's record.** [MEASURED] over its 316 lines:
`[FILE]` **314**, `[LIVE]` 0, **`[STALE]` 0**. The eleven dead PR-scoped escalation rows the station
doc's COLLECT section describes — the ones that survived ten days addressed to a station that could
not execute them — are gone. **There was nothing to discharge this run**, and that is a measurement,
not an omission.

**COLLECT.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**;
`structure: 1 checked, 0 malformed`. Crossed against `lastRunAt` from the scheduled-tasks MCP, which
the breadcrumb instrument cannot see:

| station | newest breadcrumb | `lastRunAt` | reading |
|---|---|---|---|
| `00` | 2026-09-22T00:14Z | 2026-09-22T01:14:02Z | this run; aligned |
| `03` | 2026-09-21T23:04Z | 2026-09-21T23:02:53Z | fresh and aligned |
| `04` | 2026-09-21T22:10Z | 2026-09-21T22:09:38Z | fresh and aligned |
| `05` | 2026-09-21T14:11Z | 2026-09-21T14:10:40Z | fresh and aligned, cadence daily, next 14:22Z |

**No station is SILENT and no station is in the `lastRunAt`-fresh-but-no-breadcrumb row.** The only
breadcrumb at depth 1 is the 00:14Z one, and it is **already TRACKED** — `git ls-files docs/pr-prompts`
matched it, so it reached `main` in `#2068` and is not an unreported finding. This run archives it.

**Q1 — every open PR and its `mergeStateStatus`, verbatim.** `gh pr view <n> -R <owner>/<repo>`
per PR (never a list response — §9.4's `merged` field), `$LASTEXITCODE` 0 on all three:

| PR | state | `mergeStateStatus` | labels | auto-merge | checks |
|---|---|---|---|---|---|
| `#2061` | OPEN | **CLEAN** | `[]` | none | **15 / 15 green** |
| `#2065` | OPEN | BLOCKED | `[]` | none | 14 pass / **1 fail** |
| `#2059` | OPEN | BLOCKED | `[]` | none | 14 pass / **1 fail** |

**DIRTY count: ZERO.** No PR on this board is conflicted, so no PR has frozen CI and the board is not
blocked by a conflict. `#2065` and `#2059` are BLOCKED on a red check, which is a different condition
and is dealt with in F2.

**Q2 — is a conflict something Marco must direct?** Moot: there are no conflicts. No
`pr-zzz-resolve-all-dirty-prs` prompt is armed and none is needed.

**Q3 — armed prompts, counted by me, not quoted from a note.**
`@(Get-ChildItem docs\pr-prompts -Filter '*-ready.md' | Where-Object { $null -ne $_ }).Count` → **0**
(the null-guarded count, §9.4's `NULL_COUNT_IS_IN_THE_COUNTER_V1`). The sweep agrees: `armed: 0`.

**Q4 — every claim taken from a file was re-verified live.** The 00:14Z breadcrumb's F2 asserted
`#2061` is watcher-routed and released. Both re-measured this run rather than carried forward
(DOCTRINE §10.1's non-monotonicity rule): the §10.1 step-1 probe over `processed\pr-*.log` returns
**1 hit**, and it is in the prompt's **own** log rather than in prose —
`pr-scopecards-s5-charge-steps-price-cutting-ready.md.log` →
`[watcher] merge result for PR #2061: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`.
POSITIVE control `PR #2040` → 1 hit; NEGATIVE control, a needle minted this run → **0**.

**Q5 — silent no-ops.** `no-pr-opened/` holds 109 files and its newest is **2026-09-02T03:47Z**, three
weeks old. Nothing new has been filed there, so there is no new silent no-op to read. That is stated
as a measurement of the folder, not as a claim that the folder is reliable — DOCTRINE §10.1 records a
build that produced no PR and was filed to `processed/` rather than here, so this folder's silence is
a weak signal and is not offered as an all-clear.

**Q6 — the ONE most important thing blocking progress.** `#2061` is green, released by Marco four
hours ago, receipted, and there is no actor on this board permitted to press merge on it.

**The machinery.** [MEASURED] watcher node **RUNNING pid 9744**; auto-restart wrapper **alive (1)**;
heartbeat 39 min, with `armed: 0` — an idle watcher with nothing armed is CORRECT, not wedged, and
`restart-watcher-if-wedged.ps1` was therefore **not** run and nothing was restarted. No non-main
worktrees, no registry escapees, no `index.lock` in either tree. The watcher clone reads `dirty=7`;
per DOCTRINE §9.5 that flag counts UNTRACKED files while `start-watcher.ps1` does not, so it is not
the refusal condition the sweep's own sentence claims — not re-dispatched.

**The queue.** `scripts/pipeline/triage-holds.ps1`, exit 0: **16 prompts at depth 1, HOLD=16,
ready=0, LOOPING=0**; `spent=0  gates-satisfied=0  still-gated=16  unreadable=0`. **Nothing was
armable this run.**

**`main` is genuinely green, re-derived from its own source rather than read off the sweep**
(§9.5's `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`): `gh run list --commit
4d101eeab826d38e06b76b0b074ac49198749c35` (full 40-char SHA, §9.4) → 5 runs — `CI`, `CodeQL`,
`Deploy`, `Tendering Browser Smoke` all **success**, `Claude Code`/`issue_comment` skipped.

## WHAT CHANGED

1. **Re-ran the failed `tendering-e2e` job on `#2065` and on `#2059`** — `gh run rerun 35672789296
   --failed` and `gh run rerun 35672794466 --failed`, both exit 0, both **read back** as
   `tendering-e2e IN_PROGRESS` on the PR's own check rollup. No PR content was touched.
2. **Appended an addendum to
   `docs/pr-prompts/needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`**
   (131 → **186 lines, 12,589 B**; marker `RELEASED_PR_HAS_NO_ACTOR_V1` read back present) carrying
   F1 and correcting that file's now-stale `15 pass / 0 fail` rows for `#2065` and `#2059`.
   ⚠️ **`needs-marco/` is gitignored, so that append reaches nobody on its own** — which is why its
   substance is restated in F1 below, in a tracked file.
3. **Archived the 00:14Z breadcrumb** into `docs/pr-prompts/archive/` in this run's own PR, its
   findings F2 and F4 being dispositioned here.
4. **Nothing was armed, nothing was merged, no label was touched, no process was killed, and no
   prompt was renamed.**

## FINDINGS

### F1 — `#2061` is fully released and there is no actor on this board permitted to finish it; the trigger the last run wrote down for its own DEFERRED finding has fired

`RELEASED_PR_HAS_NO_ACTOR_V1`

The 00:14Z breadcrumb deferred `#2061` on an explicit condition: *"still OPEN, still green, still
released, with **no new commit from `station-00.interactive-*`** at a later run. That is a handoff the
interactive lane dropped."*

[MEASURED] this run, every row live:

| probe | result |
|---|---|
| `gh api .../issues/2061/events`, label rows only | `labeled do-not-merge 2026-09-21T20:24:55Z` · `unlabeled 2026-09-21T23:37:38Z` — **released, never re-applied** |
| `gh pr view 2061 --json state,mergeStateStatus` | **OPEN**, **CLEAN** |
| non-green checks of 15 | **0** |
| newest AUTHORING commit on the branch | `fb797c43` `2026-09-22T00:38:25Z`, author `GH-Mantova` |
| what that commit IS | the live daily clone log — found by name shape then mtime, copied before reading, mtime `01:24:11Z` — carries `[2026-09-22T00:38:26.008Z] [update] PR #2061 branch updated (was BEHIND)`. **It is the watcher's own update step, not a lane.** POSITIVE control `[merge]` → 26; NEGATIVE control, a needle minted this run → 0 |
| newest `station-00.interactive-*` commit | `953a550b` **`2026-09-21T23:41:54Z`** — **nothing since** |

**So the condition is met exactly.** The only activity on that branch in the 1 h 44 m since the
interactive lane's last commit is the watcher mechanically re-basing it.

**Four independent things each forbid a scheduled station from merging it, and all four were
re-measured this run rather than carried forward:** the bootstrap's hard stop *never merge a
watcher-routed PR*, which binds regardless of what any document says; §10.1 step 1, whose probe
returns a real routing verdict in the prompt's own log with both controls passing (Q4 above);
YOUR LIMITS 1, under which an `escalates: true` PR is driven green and the merge left for Marco;
and `classifyPolicyFiles`, which refuses the diff's two migration files on their own clause.
Removing the label releases the *merge gate*; it does not make the prompt stop escalating, and it
does not clear a watcher verdict.

🔴 **The shape worth naming: a release is not a handoff.** Every gate here behaved correctly. The
label came off, the receipt was written, the checks are green — and the one step that turns all of
that into a merge belongs to an actor that is no longer in the room. Nothing warns, because from the
board's side a released green PR and a released green PR nobody will finish are byte-identical.

**DISPOSITION: ESCALATED** — folded onto the existing
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`, **not a new file**,
because it is the same conversation: a board of PRs that only Marco can land. The question put to him
is one line — *press merge on `#2061`, or bring the supervised interactive lane back to finish the
handoff it started?*
⚠️ **Falsifying probe: the events call and the authoring-commit list above.** If the label ever reads
re-applied, or a `station-00.interactive-*` commit appears on that branch after `23:41:54Z`, this
finding is wrong and the PR has an owner again.

### F2 — Both instrument-repair PRs flipped RED at 00:53Z on four browser tests neither diff can reach, while `main` passed the identical tests on the identical base thirteen minutes earlier

`WAITING_PR_ACCUMULATES_FLAKE_EXPOSURE_V1`

At 00:3xZ the previous run measured `#2065` and `#2059` at **15 pass / 0 fail**. At 00:53Z both were
**14 / 1**, and it is the SAME check with the SAME four failures.

[MEASURED] from the job logs — read per §9.1, splitting on the tab and searching the **last** column,
never grepping the whole line:

| | `#2065` run `35672789296` job `106572819087` | `#2059` run `35672794466` job `106572856446` |
|---|---|---|
| failing check | `tendering-e2e` | `tendering-e2e` |
| result | 167 tests, **163 passed, 4 failed** | same 4 failures |
| the diff | `scripts/pipeline/vm-git-guard.sh` — one shell script | `scripts/pipeline/status-sweep.ps1` — one PowerShell script |

All four failures are in `tests/e2e/pr-acceptance/batch1-dashboards.spec.ts`, and the first causes
the other three:

```
1) batch1-dashboards.spec.ts:262  Error: expect(locator).not.toBeVisible() failed
     Locator:  getByRole('dialog', { name: 'Customise dashboard' })
     Expected: not visible      Received: visible      Timeout: 5000ms
     > 331 |  await expect(page.getByRole("dialog", { name: "Customise dashboard" })).not.toBeVisible({ timeout: 5_000 });
2) :350  3) :398  4) :468   Error: element(s) not found
     > await expect(nav.getByRole("link", { name: dashName })).toBeVisible({ timeout: 10_000 });
```

**The dashboard the first test creates never lands, so the three that look for it in nav cannot find
it.** One 5-second timeout, three cascade failures.

🔴 **`main` ran the identical spec at the identical commit and passed every one of them.** Run
`35672608910`, job `tendering-e2e` `106572252240`, on `4d101eea` itself: **166 passed**, and the
per-test list includes `batch1-dashboards.spec.ts` at `:262`, `:350`, `:398` and `:468` — the exact
four. That job really ran the suite; it is not a path-filtered no-op wearing a green tick.

So this is station doc **rule 5**'s named transient class — *a CODE check failing on a docs-only or
unrelated diff while `main` is green* — and the honest reading is a timing-sensitive browser
assertion, not a defect in either PR. **ACTIONED:** re-ran the failed jobs on both, read back
`IN_PROGRESS` on both. Per DOCTRINE §2 this is not a re-run hoping for green: the cause is named —
a 5 s dialog-close assertion under concurrent-runner load — and the discriminating evidence is
`main`'s pass on the same bytes.

⚠️ **The part that is worth more than the re-run: a PR that waits on Marco accumulates flake
exposure, and nothing else on this board does.** The watcher re-bases every open PR each time `main`
moves — `[update] PR #2061 branch updated (was BEHIND)` appears **four** times for `#2061` alone in
tonight's log — and every re-base re-runs the whole e2e suite. **Each re-run is an independent chance
for a timing-sensitive test to flip a finished PR red.** A PR that merges promptly is exposed once; a
PR that waits eighteen hours is exposed as many times as `main` moves. The visible cost is that an
instrument-repair PR is more likely to *look* unready the longer it waits, which is precisely the
wrong signal to send to the only person who can merge it.

**DISPOSITION: ACTIONED** — re-runs dispatched and read back; the stale `15 pass / 0 fail` rows in the
standing escalation corrected in the same breath, so Marco does not open that file and find a
contradicted claim.
⚠️ **Falsifying probe: the two job logs against `main`'s.** If the four tests ever fail on `main` at a
commit where they pass on a PR, the transient reading is wrong and this is a real regression that the
PR is masking.

### F3 — Nothing was armable, and `triage-holds.ps1` again declared its own clean result SUSPECT while both of its controls passed

`TRIAGE_SUSPECT_WARNING_FIRES_ON_A_LEGITIMATE_UNIFORM_RESULT_V1`

[MEASURED] `triage-holds.ps1`, exit 0: `16 prompt(s) at depth 1, HOLD=16, ready=0, LOOPING=0`;
`spent=0  gates-satisfied=0  still-gated=16  unreadable=0`. **Zero gate-satisfied candidates**, so
there was no arming decision to make and `armed: 0` with an idle watcher is the correct state of the
queue rather than a stall.

The script then printed, in the same run:

```
GIT control: PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (214264 chars), so gate probes can actually run.
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is measurable.
control: 3 open PR(s) read from the board; 0 admitted prompt(s) scanned.
!!! SUSPECT: every prompt landed in ONE bucket. That is the signature of a broken
```

**Third consecutive reproduction.** The warning's premise — *a uniform result means a broken
instrument* — is §9.6's rule applied backwards: here the instrument is demonstrably working (both
controls PASS, and the gate probe read 214,264 characters of `DOCTRINE.md` to prove it), and a board
where every HOLD is correctly still gated is a perfectly ordinary uniform truth.

⚠️ **Its polarity is the safe one and that is why it is deferred rather than fixed under pressure:**
it makes a run distrust a CLEAN result, never act on a dirty one. The failure it can cause is a
wasted investigation, not an arm.

**DISPOSITION: DEFERRED.** The fix is in `scripts/pipeline/triage-holds.ps1` — outside this station's
recorded `docs/` lane to merge, on a board where all three open PRs already wait on Marco, so opening
a fourth he must also land buys nothing this hour.
⚠️ **What would make it urgent:** the warning firing on a run that DOES have gate-satisfied
candidates, where "distrust the result" would mean declining to arm real work. Tonight it fired on
`gates-satisfied=0`, where there was nothing to decline.

## WHAT I DID NOT DO

- **Did not merge `#2061`** — four independent prohibitions, each re-measured live (F1). It is green,
  released and receipted, and staying off it is the deliverable.
- **Did not merge `#2065` or `#2059`.** Both are `scripts/`, i.e. outside `tests|docs` and outside
  this station's recorded `docs/` lane. `STATION-CAPABILITIES.md` §5 stopped licensing exactly this
  merge at 00:4xZ last night (`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`), and this run is
  the first to operate under the narrowed sentence. Both are Marco's.
- **Did not restart the watcher.** `pid 9744` alive, wrapper alive, `armed: 0`. An idle watcher with
  an empty queue is correct, and `restart-watcher-if-wedged.ps1 -Fix` is only ever run on a
  WEDGED/DOWN verdict from that script.
- **Did not dispatch the watcher clone's `dirty=7` to Station 03.** DOCTRINE §9.5 records that the
  sweep's clone-dirty flag counts untracked files while `start-watcher.ps1` does not, and that
  mis-routed dispatch has already been made repeatedly. The corruption test — `MERGE_HEAD`, rebase
  state, unmerged paths — is what decides, and it is clean.
- **Did not arm anything.** `gates-satisfied=0` of 16; there was no candidate.
- **Did not discharge anything from `needs-marco/`.** Section 5 of the sweep carried **zero**
  `[STALE]` rows against 314 `[FILE]` rows, so there was nothing dead to clear.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or any label.**
- **Did not run `git` through the device bridge against the Windows `.git`.** Every git call in this
  run went through PowerShell on the host.
- **Left alone:** the 109 files in `no-pr-opened/` (newest three weeks old, nothing new), the 59 in
  `failed/` (newest are `rev-*` review jobs, not prompts), the 16 gated HOLDs, the untracked
  `docs/pr-reviews/pr-*.md` verdicts in the dev tree, and the backlog's one READY item
  (`rates-11c-blocked-consumers`), which is a Marco-class decision and not an arming candidate.
