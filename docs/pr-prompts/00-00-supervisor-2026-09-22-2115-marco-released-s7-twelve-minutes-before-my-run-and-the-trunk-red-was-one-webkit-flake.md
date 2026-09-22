# Station 00 — Supervisor | 2026-09-22T21:15:10Z–2026-09-22T21:36Z

## GROUND

```
UTC            2026-09-22T21:15:10Z
origin/main    2b376f88   (at start; f3162a44 after this run's merge)
dev tree       main @ 2b376f88   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (1 == 1). Full authority, not read-only.

NOT BLIND. Desktop Commander reached the Windows host on the first call after loading the schema
(`start_process`, `powershell.exe`, PID 28260). Every `git` and `gh` in this run executed in a shell
on the Windows host; none against the mount.

## WHAT I MEASURED

**Freshness — CLEAN, and no station is SILENT.** `node scripts/pipeline/check-breadcrumb.mjs
--freshness` → exit **0**. [MEASURED]

```
00  last 2026-09-22T20:40:00Z   0.6h ago  (cadence 1h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-21T23:04:00Z  22.2h ago  (cadence 24h)  ok
04  last 2026-09-22T18:10:00Z   3.1h ago  (cadence 4h)   ok
05  last 2026-09-22T14:23:00Z   6.9h ago  (cadence 24h)  ok
structure: 2 checked, 0 malformed
```

**Guard — exit 2, INSTALLED BUT INERT.** `bash "$HOME/mnt/.../vm-git-guard.sh"`, exit code read from
the installer itself and not from a pipeline appended to it. [MEASURED] Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/elegant-great-hypatia/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

That is the EXPECTED middle outcome for a station, not an anomaly: the shell is non-interactive and
non-login, so neither `~/.bashrc` nor `~/.profile` is sourced. The device-bridge git ban was
therefore REMEMBERED this run, and honoured — no `git` ran against the mount.

**Binding docs are current.** `git diff --numstat origin/main --` over `00-supervisor.md`,
`DOCTRINE.md`, `STATION-CAPABILITIES.md` → **EMPTY**, with `HEAD...origin/main` = `0 0`. [MEASURED]
No pipe-to-`hash-object` was used; PREFLIGHT step 2 forbids it in PowerShell.

**Dev tree clean on all four probes.** `rev-list --left-right --count` `0 0` · `--numstat` EMPTY ·
`--cached --name-status` EMPTY · `status --porcelain --untracked-files=no` EMPTY. [MEASURED]

**Machinery healthy.** `restart-watcher-if-wedged.ps1` → `VERDICT: HEALTHY - no action.` Node
`pid 9744`, parent chain resolved three deep and not inferred from a name match: [MEASURED]

```
[0] 9744  node.exe        pr-watcher/index.mjs
[1] 17688 powershell.exe  scripts/pr-watcher/...
[2] 30116 powershell.exe  C:\po-watcher\watcher-launcher-singlelane.ps1
```

No `index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, rebase-merge, rebase-apply or
sequencer in either tree. 0 git processes touching our trees.

**RULE-2 probe, with both controls.** `docs/pr-prompts/processed/*.md.log`, corpus **2379** logs.
POSITIVE control `marco":true` → **699** hits. NEGATIVE control `merge result for PR #99999999:` →
**0**. Verdict lines naming **#2093, #2099, #2100, #2101, #2102** → **0 each**. [MEASURED]
So: `[NO LANE VERDICT — hand-classified]` for all five. An empty result here is not an empty world
(§9.6 / §10.1), so each was classified by hand below.

**`classifyPolicyFiles` read from the function on `origin/main`, not from DOCTRINE's summary.**
`git show origin/main:scripts/pr-watcher/index.mjs`, 152237 chars; POSITIVE control
`classifyPolicyFiles` → 2 hits, NEGATIVE control `zzzNoSuchTokenZzz` → 0. [MEASURED] The array is
still the three-form version, so §10.1's paragraph is still correct:

```js
const NESTED_TEST_PATHS = [ /^(tests|docs)\//, /(^|\/)__tests__\//, /\.(test|spec)\.[cm]?[jt]sx?$/ ];
```

Applying it by hand to the five open PRs:

| PR | paths | classifier | whose |
|---|---|---|---|
| #2093 | `apps/api/prisma/migrations/…` ×3 + 13 more | `migration file:` → **ok:false** | Marco's — **and Marco released it**, see F1 |
| #2099 | `docs/pr-prompts/…-HOLD.md` | **ok:true** | automatic lane |
| #2100 | **`Claude Design/proposed/s8-s9-haulage-capacity/haulage-capacity-mockup.html`** + 1 | `outside tests/ or docs/:` → **ok:false** | **Marco's** — see F3 |
| #2101 | `docs/pr-prompts/…-HOLD.md` | **ok:true** | automatic lane |
| #2102 | `docs/pr-prompts/…-HOLD.md` | **ok:true** | automatic lane |

**Trunk was RED at run start, on one WebKit engine flake.** `Tendering Browser Smoke`, run
`35780969358`, job `tendering-e2e`, on `2b376f88`. Read from `gh run view --log-failed`, not from the
diff. [MEASURED]

```
✘ 15 [webkit] › tendering.spec.ts:44:7 › /tenders renders the redesigned register page (23.1s)
   Error: page.goto: WebKit encountered an internal error
     - navigating to "http://127.0.0.1:4173/", waiting until "load"
     at loginWithStoredState (tests/e2e/pr-acceptance/helpers.ts:88:14)
1 failed · 19 passed (1.8m)
```

Four independent reasons this is transient, not a defect: the SAME test passed on **chromium** and
**firefox** in the same run; the other **four** webkit tests in the same file passed; the error is an
engine internal error at `page.goto`, not an assertion; and `2b376f88` is **#2098, a docs-only
breadcrumb merge** — a CODE check failing on a docs-only diff. History of the workflow on `main`,
last 14 runs: **13 success, 1 failure**, the failure being exactly this commit. [MEASURED]

**Sweep section 5 — no `[STALE]` rows this run.** Every `needs-marco/` line came back `[FILE] …
section 5 CANNOT decide` or `no PR ref`. **Nothing was dischargeable on a tag alone, so nothing was
discharged.** `needs-marco/` stands at **61**. [MEASURED]

**Tracked-set probe asked `origin/main`, never the dev tree index** (`git ls-tree -r --name-only
origin/main -- docs/pr-prompts/`, matched by basename). My 2026-09-22 20:10 and 20:40 breadcrumbs →
**1 tracked path each**; NEGATIVE control `00-00-supervisor-1999-01-01` → **0**. [MEASURED] Both
prior runs reported; neither needed re-committing.

**[CANNOT MEASURE] the post-merge trunk verdict.** `Tendering Browser Smoke` on `f3162a44`
(run `35786436290`) was still `in_progress` after six polls over ~2 min when this run ended.

## WHAT CHANGED

**#2093 merged to `main`.** `feat(tendering): scopecards S7 - one cutting total on the server
(CUTTING_ONE_TOTAL_V1)`.

- Re-measured immediately before acting (`[LIVE]` expires): `state=OPEN mergeState=CLEAN
  mergeable=MERGEABLE labels=[] checks=15 pending=0 failing=0`, head `e06fd08f`.
- Sanctioned path only: `. pipeline-lib.ps1` → `Assert-SmokedOrEscalate -PR 2093` → **True** →
  `Merge-Pr -PR 2093` → **True**. No hand-merge.
- Read back, four ways: `state=MERGED`, `mergedAt=2026-09-22T21:24:16Z`,
  `mergeCommit=f3162a44f31a09dd1071e34880895f9991ae9e1f`; `origin/main` now `f3162a44`;
  `git merge-base --is-ancestor <mergeCommit> origin/main` → **exit 0**; content proof
  `git cat-file -e origin/main:apps/api/src/modules/tendering/cutting-line-pricing.ts` → **exit 0**,
  with a NEGATIVE control on a non-existent sibling path → **exit 128**.

Nothing else was mutated. No prompt armed, no label touched, no process killed, no `sot/` edit.

## FINDINGS

**F1 — Marco released #2093 twelve minutes before this run, and only this station could land it.**
The merge-approval receipt on the branch (`docs/decisions/merge-approvals/2093.md`) records
`approved_by: marco`, `approved_at: 2026-09-22T21:03:48Z`, "Marco removed the `do-not-merge` label
himself … and said 'Label removed' in chat", and names the merge path *"Assert-SmokedOrEscalate then
Merge-Pr, on a green head."* The PR carried **no** labels at measurement and was 15/15 green. The
watcher would not have merged it — it was opened from an `escalates: true` prompt and labelled
`do-not-merge` on open, so its own policy step routes it to Marco forever. Without this station it
would have sat green and released indefinitely.
**DISPOSITION: ACTIONED** — merged at 21:24:16Z, `f3162a44` proven on `main` by ancestor check plus a
content proof with a negative control (see WHAT CHANGED).

**F2 — the trunk red was a WebKit engine flake and the merge re-ran it, so no `gh run rerun` was
spent.** Diagnosis is from the job log, never the diff (LIMIT 6). Rule 5 says re-run a suspected
flake before calling it a defect; merging #2093 fired a fresh `Tendering Browser Smoke` on
`f3162a44` (`35786436290`), which is that re-run. It had not concluded when this run ended.
⚠️ **Falsifying probe for the next run: open `35786436290`.** If it failed on the SAME
`[webkit] tendering.spec.ts:44` navigation, this is a real regression in webkit handling of
`page.goto("/")` and not a flake, and F2 must be re-measured as a defect. If it failed on anything
else, that is a different finding. If it passed, the flake reading is confirmed and `main` is green.
**DISPOSITION: DEFERRED** — real, and not now: the instrument that answers it was still running. It
becomes urgent the moment a second consecutive `main` run fails on the same webkit test, which would
turn 13-of-14 into a pattern.

**F3 — #2100 looks identical to its three siblings on the board and is the only one of the four the
policy gate will NOT pass.** #2099, #2101 and #2102 touch only `docs/pr-prompts/*-HOLD.md`. #2100
also carries `Claude Design/proposed/s8-s9-haulage-capacity/haulage-capacity-mockup.html`, which
matches none of the three `NESTED_TEST_PATHS` forms, so `classifyPolicyFiles` returns
`{ok:false, reason:"outside tests/ or docs/: Claude Design/…"}` and the watcher will route it to
Marco. On the board all four read `CLEAN`, unlabelled, 10/10 green — **nothing distinguishes the one
that will stop.** `needs-marco/` is already at 61, which is where a PR that stops silently goes to be
forgotten. The machinery is working correctly; the defect is that the stop is invisible until it
happens.
**Marco — one question, options in RULE-1 order:**
(a) **Merge #2100 yourself once its review lands** — complete (the mock-up ships with the prompt that
describes it) and additive (nothing is reclassified, no gate is weakened). This is the recommendation.
(b) Split the mock-up into its own PR so the HOLD prompt merges on the automatic lane — complete, and
additive, but costs a second PR every time a prompt ships with a design asset.
(c) Add `Claude Design/` to `NESTED_TEST_PATHS` — fails the *complete* half: it widens the automatic
lane for every future design asset, not just this one, and §10.1 requires a CI gate proving a lane's
boundary before that lane is trusted. Not recommended.
**DISPOSITION: ESCALATED** — named here for Marco with the three options above. No `needs-marco/`
file was written: the PR is not yet blocked, its review is still in flight, and adding a 62nd file to
a queue where nothing was dischargeable this run would bury it rather than surface it.

**F4 — the spent S7 prompt is still sitting in the board root.**
`docs/pr-prompts/pr-scopecards-s7-one-cutting-total-HOLD.md` is tracked on `origin/main` and its PR
(#2093) merged during this run. §8.5 gives it exactly one correct home — `docs/pr-prompts/merged/`,
entered only on a confirmed MERGED state, which is precisely what WHAT CHANGED proves. That folder
holds **0** files on `origin/main` today and §8.5 marks the standard *"written in S1, enforced in
S4"*, so this run did **not** create it: establishing a queue-layout folder ahead of its enforcing
slice is a change to the standard's rollout, not a supervisor's call, and a wrong guess there would
have to be undone in every later run.
**DISPOSITION: DISPATCHED** — to **Station 06 / the S4 queue-layout slice**, which owns
`docs/pr-prompts/` staging and the `merged/` cutover. What is handed over: retire
`pr-scopecards-s7-one-cutting-total-HOLD.md` as the first `merged/` entry, citing #2093 merged
2026-09-22T21:24:16Z at `f3162a44`. It is inert where it sits — the watcher globs only `*-ready.md`
— so this is tidiness, not risk.

**F5 — two items in the watcher's local trees belong to Station 03, not to me.** [MEASURED]
`C:\po-watcher\ProjectOperations` is on `main` with 6 untracked files: `.codex/`, `AGENTS.md`,
`scripts/pr-watcher/.conflict-notified-prs.json`, and `docs/pr-reviews/pr-2093-review.md`,
`pr-2099-review.md`, `pr-2100-review.md`. The sweep flags this as *"NOT clean-on-main; the watcher
may refuse to start"*. Separately, `C:\po-wt\s7fix` is an orphaned worktree at `814c310f` — the exact
fix commit named in #2093's receipt — `dirty=0`, age 121 min, now spent by the merge above.
**Note the three review files are the good news in this finding:** verdicts for #2099 and #2100
already exist on disk, so the review lane is producing, not stalled.
**DISPOSITION: DISPATCHED** — to **Station 03** (the watcher process, queue files and local trees are
its lane; mine is the board). Two items: assess whether the 6 untracked files in the watcher clone
threaten a watcher restart, and prune `C:\po-wt\s7fix` now that `814c310f` is on `main`. I did not
touch either — doing another station's job badly is LL-38, and `git status --short` in a worktree
before any prune is 03's documented precondition, not mine.

**F6 — the device-bridge git ban was not mechanical this run.** `vm-git-guard.sh` exited **2**:
the shim is byte-correct and unreachable from a non-login, non-interactive shell. DOCTRINE §9.2
records this class of protection as having failed seven times when it was only remembered.
**DISPOSITION: DEFERRED** — real, and not now: exit 2 is the contract's documented EXPECTED outcome
for a station, and the run complied by putting every `git` on the Windows host instead. It becomes
urgent if a run ever reports a 0-byte `index.lock` with no owning process, which is the failure the
guard exists to prevent.

**F7 — COLLECT: two breadcrumbs since my last run, both fully dispositioned, and one of them is the
escalation that closed this run.** The tracked set on `origin/main` (not the dev tree index) holds
`…-2026-09-22-2010-…` and `…-2026-09-22-2040-…`, and every finding in both already carries one of the
four dispositions — 0 findings left open by either. **The 20:10 run ESCALATED #2093 to Marco**
(*"#2093 is Marco's on both gates (`do-not-merge`, which only he removes …)"*); Marco removed the
label at **21:03:48Z**; this run merged it at **21:24:16Z**. Escalation → release → merge, closed
inside 74 minutes, which is the channel working exactly as designed. Two ESCALATED questions from the
20:40 run remain open for Marco and are **not** re-asked here — re-raising an unanswered question
every hour is how a real question becomes noise. Standing hand-overs to Station 03 (orphaned
worktrees, watcher clone dirty) are carried forward unchanged in F5, with nothing new added.
**DISPOSITION: ACTIONED** — both collected and archived to `docs/pr-prompts/archive/` in this run's
board PR. Archiving is safe for freshness: `check-breadcrumb.mjs` builds its set with `git ls-tree -r`
and matches by **basename**, so an archived breadcrumb still counts and can never make a station read
SILENT.

## WHAT I DID NOT DO

**Armed nothing.** All 15 `-HOLD.md` prompts are tracked, and none is eligible: 9 carry
`escalates: true` (4 of those gated on a `docs/approvals/…-approved-by-marco.md` file that is not on
`main`, and `pr-fv2-formrule-contract` / `pr-siteid-notnull-backfill` are on the standing never-arm
list); `pr-fv2-ai-digests` and `pr-fv2-output-channels` are gated on
`apps/api/src/modules/forms/*.service.ts` files; `pr-scopecards-s7-one-cutting-total-HOLD` is SPENT
(F4). That leaves four ungated candidates — `pr-devtree-sync-ff-only-guard`,
`pr-nav-jobs-projects-merge`, `pr-queue-layout-sot-entry`, `pr-vendor-invoice-ocr`. **I deliberately
armed none of them.** The board already carries 4 open PRs awaiting review and the watcher is
mid-build with 4 armed review prompts; adding a fifth work item would have grown queue depth, not
throughput. Arming is one-at-a-time and cheap to do next run, when the four docs PRs have cleared.

**Did not merge #2099, #2101 or #2102**, though all three are `CLEAN`, unlabelled, 10/10 green and
pass the policy classifier. Their reviews were **in flight at that moment** — the sweep caught
`BUILD IN FLIGHT: rev-2101-ready.md (tick 0.4 min old)` and review files for #2099 and #2100 already
exist in the watcher clone. Merging out from under a running reviewer is two actors on one object,
which is the LL-38 shape. The watcher's own merge step will take them, and F3 flags the one it will
not.

**Did not clear any `needs-marco/` file.** Sweep section 5 produced no `[STALE]` row; every line was
`CANNOT decide`. The station doc is explicit that these are never cleared on a tag alone, and none
had a tag to clear.

**Did not touch Azure, Entra or SharePoint; wrote no production data; edited no `sot/`; committed
nothing to `main`; removed no label; killed no process.**

**Did not run `gh run rerun`** on the red trunk — merging #2093 fired the re-run for free (F2).

**Did not create `docs/pr-prompts/merged/`** — F4 explains why that is the S4 slice's call.
