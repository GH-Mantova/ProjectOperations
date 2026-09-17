# Station 04 — Scanner | 2026-09-17T10:11Z–2026-09-17T10:27Z

## GROUND

```
UTC            2026-09-17T10:11:09Z
origin/main    8c99443c            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 8c99443c     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. Full authority for the lane (read-only on the board).

Tree read: the **dev tree**, `C:\ProjectOperations2`, which is `0 0` against `origin/main`
(`git rev-list --left-right --count origin/main...HEAD` → `0 0`). All three binding documents were
verified byte-identical to `origin/main` before being read, by the sound form only
(`git diff --numstat origin/main -- <path>`, EMPTY = not different) — never a piped hash (§9.1).

Sweep this run: **repo-hygiene**, assigned by `node scripts/pipeline/next-sweep.mjs`
(rotation position 3 of 4; previous run 2026-09-17T02:21:13Z). Not chosen.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` after a keyword `ToolSearch` for
`desktop-commander` — the shell answered on the first call with `main` / `8c99443c`. **This run was
SIGHTED.** Not a blind run, and nothing below is a mount-only reading.

**Device-bridge git guard, installer's last line quoted as the contract requires.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → exit 0:

```
vm-git-guard installed at /sessions/<session>/.local/bin/git - refuses mounted paths and mounted cwd,
allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS. Every `git` in this report ran through Desktop Commander on the Windows host, never the VM.

**Binding-document freshness.** [MEASURED] `git diff --numstat origin/main -- <path>` returned EMPTY
for all three: `docs/pipeline/stations/04-scanner.md`, `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`. All three read in full.

**Preflight sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, captured to a file and decoded
`utf16le` in node (§9.3 — the `*>` redirection wrote a 129,564-byte UTF-16LE file, exactly as that
bullet predicts). Section 0 controls both PASS (`gh` reached GitHub, saw merged #2001; node runs).
Section 7 verdict: `[LIVE] SAFE TO ACT`. Board: 2 open PRs (#2002, #1998, both RED), trunk green on
`8c99443c`, watcher node RUNNING pid 30248, armed `*-ready.md` = 0.

**Negative control, minted this run and therefore now SPENT:** `zzQq04Hyg20260917T1030`. It returned
**0** against every corpus it was run over (tracked queue listing, `git grep origin/main -- apps
scripts tests`, `git ls-remote --heads origin`, `git rev-parse origin/main:<path>`, #2002's PR body).
It is written down here, so it must never be used again (§9.6).

**THE BOARD TRAP — CLEAN.** [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`
(trailing slash, `-r`, result filtered rather than the pathspec globbed — §9.2) → 1254 tracked paths,
**54 at depth 1**, of which `*-ready.md` = **0**. On disk, `Get-ChildItem -File` at depth 1 → 56
files, `*-ready.md` = **0**, `*-LOOPING*` = **0**. POSITIVE control `git ls-files --error-unmatch
CLAUDE.md` → found, exit 0. NEGATIVE control, the minted needle over the same listing → 0. **No
tracked ready-file at depth 1; no armed prompt anywhere.** The board trap does not fire this run.

**Depth-1 census reconciles exactly**, which is what lets the counts above be trusted: 54 tracked
(38 `-HOLD.md`, 8 structural — `.arming-log.txt`, `BACKLOG.yaml`, `BACKLOG-DECISIONS.md`,
`ESCALATIONS.yaml`, `PROMPT-SCHEMA.md`, `README.md`, `TEMPLATE-sot-reconcile.md`,
`shepherd-state.md` — and 8 station breadcrumbs), minus 3 tracked-but-deleted (finding F6), plus 2
untracked (`.queue-sync-ledger.txt`, `queue-watch-state.md`) plus 3 gitignored `.log` leftovers found
with `git ls-files --others --ignored --exclude-standard` (`git status` is structurally blind to
them — §9.2) = **56**, the disk count.

**Locks: none.** [MEASURED] four probes, all ABSENT — `C:\ProjectOperations2\.git\index.lock`,
`C:\po-watcher\ProjectOperations\.git\index.lock`, and both `locked` / `index.lock` under
`.git\worktrees\po-vg`. Sweep section 3 agrees (`index.lock interactive/clone: False / False`, 0
scoped git processes). So the one surviving orphan worktree is not freezing anything, and no stale
0-byte lock exists to measure for age.

**Re-derived the sweep's clone-dirty warning, and DOCTRINE §9.5's bullet STANDS.** That bullet's own
falsifying probe is *"run both forms against the clone in the same minute while an untracked file is
present; if they ever agree, this bullet is wrong."* [MEASURED] in one call:
`git -C C:\po-watcher\ProjectOperations status --short` → **3**
(`?? docs/pr-reviews/pr-1998-review.md`, `?? docs/pr-reviews/pr-2002-review.md`,
`?? scripts/pr-watcher/.conflict-notified-prs.json`) against
`git status --porcelain --untracked-files=no` → **EMPTY**. They did NOT agree. So the sweep's
`[LIVE] watcher clone: branch=main dirty=3 <-- the watcher may refuse to start` is the known false
warning — two of the three files are review verdicts the `rev-<N>` job writes into the clone by
design — and it must not be dispatched to Station 03 as clone hygiene. No finding is filed on it.

**HOLD triage.** [MEASURED] `scripts/pipeline/triage-holds.ps1` (read-only, mutates nothing), exit 0.
Its own instrument control is quoted in its output: `SPENT control: PASS -- lint-prompt.mjs emitted
exit 3 on the fixture, so the SPENT bucket is measurable` — the positive control §7 requires before a
negative verdict is believed. Totals: `spent=7 of 35 evaluated  gates-satisfied=2  still-gated=26
unreadable=0`, and the script re-probed all 26 rejects directly for `0 spent behind a REJECT`.

**Worktree registry, both trees.** [MEASURED] `git worktree list` in the dev tree returns exactly
**two** entries — `C:/ProjectOperations2 8c99443c [main]` and
`C:/PR-Master/worktrees/po-vg 23c91ba9 [fix/no-rebase-while-checks-run]`. The clone returns one.
On disk: `C:\po-worktrees` → 0 directories, `C:\po-wt` → 0 directories,
`C:\po-watcher-worktrees` → ABSENT, `C:\PR-Master\worktrees` → 1 (`po-vg`).

**`po-vg`'s preserved file is still there, twice over.** [MEASURED]
`C:\po-sup-fix-scripts\PRESERVED-po-vg-check-pipeline-heartbeat-2026-09-05.mjs`, 6144 B,
`git hash-object` → `9c4587fbf4e906fca096941f014de8ef4671ebee`, identical to the worktree copy; and a
local branch `preserve/pipeline-heartbeat` (tip `f6c7ca42`, 2026-09-04, *"preserve
check-pipeline-heartbeat.mjs rescued from an orphaned worktree"*). `origin/main` holds a **different**
blob at that path (`84ec92d4`), so the bytes were genuinely unique and are now triply held.

**Remote vs local refs.** [MEASURED] `git ls-remote --heads origin` — asking the remote, never
`git branch -r` (§9.2) — returns **15** heads. `git branch -r` returns **54**. `git branch` returns
**447**. POSITIVE control, `refs/heads/main` present in the `ls-remote` output → 1; NEGATIVE control,
the minted needle → 0.

**Branch-by-branch board classification, read from `mergedAt` and never from `merged` (§9.4), with
`-R <owner>/<repo>` and `$LASTEXITCODE` tested before parsing (§9.4's CWD bullet).** All 14 non-main
remote heads:

| remote head | PR | state | mergedAt |
|---|---|---|---|
| `feat/crmvis-s5-followups` | #1998 | OPEN | — |
| `feat/rates-tc-column-order` | #2002 | OPEN | — |
| `chore/sweep-breadcrumbs-20260907-0934` | #1778 | **MERGED** | 2026-09-07T09:41:35Z |
| `docs/st00-collect-2026-09-14-1108` | #1927 | **MERGED** | 2026-09-14T11:19:14Z |
| `fix1483` | **NO PR** | — | — |
| `docs/slice-0-scope-cards-plan` | #1871 | CLOSED | — |
| `feat/crm-account360-v2-s1` | #1612 | CLOSED | — |
| `feat/ratescol-s2-column-settings-move-delete` | #1960 | CLOSED | — |
| `feat/ratescol-s3-grid-add-column-row-guided-step` | #1978 | CLOSED | — |
| `feat/verdict-home-resolver` | #1703 | CLOSED | — |
| `feat/verdict-home-resolver-v1` | #1707 | CLOSED | — |
| `fix/verdict-home-resolver-v1` | #1708 | CLOSED | — |
| `fix/verdict-home-resolver-v1-impl` | #1705 | CLOSED | — |
| `fix/classify-policy-nested-tests` | #1571 | CLOSED | — |

13 of 14 returned rows, so the single `NO PR` is a real answer and not the uniform zero §9.4's CWD
bullet warns about. The four `*verdict-home-resolver*` heads are the kill-loop duplicates DOCTRINE
§9.5 already records.

**`fix1483` resolved — its work HAS shipped.** [MEASURED] 486 behind / 28 ahead of `origin/main`,
tip `9de07267` 2026-09-02, holding **4 non-merge commits** of real product work plus 24 `Merge branch
'main' into feat/scope-s2-wbs-table-shell` commits. `gh pr view 1483` → **MERGED
2026-09-02T02:46:46Z**, head `feat/scope-s2-wbs-table-shell` (already deleted from the remote).
Every artefact of that work is on `origin/main`: `ScopeQuantitiesTable.tsx`,
`__tests__/wbs-table-shell.test.tsx`, `__tests__/scopeItemDensityUnits.test.ts` and
`docs/decisions/merge-approvals/1483.md` all resolve via `git rev-parse --verify origin/main:<path>`
(POSITIVE control `origin/main:CLAUDE.md` → `5e9801db`; NEGATIVE control, the minted needle → empty).
`git grep -c SCOPE_WBS_TABLE_V1 origin/main -- apps/web` → 5 files. So `fix1483` is a **rescue branch
whose content is fully landed**, not stranded work.

**The `2026-09-14` orphan-worktree escalation, re-verified per §7.1's re-read rule.** Its own
falsifying probe is *"`git worktree list`; `git -C <worktree> rev-list --count origin/main..HEAD`; if
either named worktree ever returns 0 unpushed commits, this escalation is spent."* [MEASURED] both
named worktrees are **ABSENT from disk AND from the registry** — `C:\po-fix1891` → ABSENT,
`C:\PR-Master\worktrees\pr1823` → ABSENT, and `git worktree list --porcelain` lists neither.

That absence is **not** the reading the probe asks for, and on its own it proves nothing about the
commits (§9.6 — a pruned worktree and a saved branch look identical from here). So both tips were
chased to `main` instead:

| probe | result |
|---|---|
| `git cat-file -e 1dc31858^{commit}` | exit 0 — **object survives** |
| `git cat-file -e 9664f95a^{commit}` | exit 0 — **object survives** |
| NEGATIVE control, `deadbeef…^{commit}` | exit **128**, loud |
| `git for-each-ref --contains 1dc31858` | **0 refs** — unreferenced, gc-eligible |
| `git for-each-ref --contains 9664f95a` | **1** — `refs/heads/feat/ea-gate-reporting-team-permission` |
| POSITIVE control, refs containing `origin/main` | 5 |
| `git rev-list --count origin/main..1dc31858` | **14** |
| `git rev-list --count origin/main..9664f95a` | **4** |
| `gh pr view 1823 --json state,mergedAt,headRefName` | **MERGED** 2026-09-11T02:57:48Z, head `feat/ea-gate-reporting-team-permission` |
| `gh pr view 1891 --json state,mergedAt,headRefName` | **MERGED** 2026-09-14T02:05:09Z, head `worktree-agent-ab8ed118705aa1958` |

**Both chains are the pre-squash history of already-merged PRs.** Every merge commit in
`origin/main..1dc31858` reads `Merge branch 'main' into worktree-agent-ab8ed118705aa1958` — an exact
identity match to #1891's `headRefName` — and #1891's squash commit is on `main` as `5036c74c`
*"feat(tendering): draftpanel S1 rates-lock gate on the Scope of Works tab (#1891)"*. `9664f95a` sits
on #1823's head branch, merged six days earlier.

⚠️ **And the obvious per-commit probe answers the wrong question here, which is worth recording
because it would have inverted the verdict.** Searching `main` for each of the six non-merge commit
subjects returns **0 on all six** (POSITIVE control, `--grep 'queue layout S1' --fixed-strings` → 1;
NEGATIVE control, the minted needle → 0). That zero is the **signature of a squash merge**, not
evidence of loss — the branch's individual subjects never reach `main`, only the one squash subject
does. This is the identical trap the `po-vg` escalation's own 2026-09-06 refutation records
(*"a squash merge under a different branch name satisfies the second while failing both of the
first"*). Read at face value, six zeroes and a gc-eligible commit compose into *"fourteen commits are
one `git gc` from gone"* — a confident, coherent, wrong S1.

**Stash growth.** [MEASURED] `git stash list` → dev tree **1**, watcher clone **77**. DOCTRINE §9.5
records **71** in the clone on 2026-09-10; that is state and is re-measured here, not quoted — **+6
in seven days**.

**Queue folder census.** [MEASURED] `superseded/` 444 files · `archive/` 791 · `needs-marco/` 204 ·
`needs-marco/discharged/` 68 · `merged/` **ABSENT** · `brainstorm/` **ABSENT** · `draft/` **ABSENT** ·
`exceptions/` **ABSENT** · `reports/` **ABSENT**.

**This breadcrumb is `breadcrumb-clean`, and the claim is earned rather than asserted.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs` → **exit 0**, `structure: 9 checked, 0 malformed, 0
skipped`, `CLEAN`, with this file listed `ADMIT` and carrying the expected
`NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`.
`--freshness` → exit 0, `CLEAN`, all four stations `ok`. No `lint-prompt.mjs` result is quoted
anywhere in this report: it gates `docs/pr-prompts/` as *prompts*, rejects a breadcrumb for having no
front matter, and its verdict on one is not evidence in either direction.

**Precedent check on the spent-HOLD finding.** [MEASURED] a local branch
`chore/retire-seven-spent-holds` exists (tip `7c8c7322`, 2026-09-07); `gh pr list --head` on it → **#1776
MERGED 2026-09-07T09:21:10Z**, whose diff is seven `R100` renames into `superseded/`. Its seven files
are a **different** set from today's seven, so F3 below is a fresh crop and not unlanded work — and
#1776 is the exact mechanism to reuse.

## WHAT CHANGED

**`docs/pipeline/sweep-rotation.json` — advanced and LEFT DIRTY.**
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-17T10:11:09Z` → exit 0,
`advanced: last_index=2 last_run_utc=2026-09-17T10:11:09Z`. Read back:
`git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2`. The script's own
output says to leave it and name it here. **Station 00 must commit this file with its next board PR —
Station 04 may not commit to the shared dev tree** (authority matrix: 04 *Create a PR: NO*,
*Mutate the board: NO, read-only*; the dev tree is on `main`, which nobody commits to directly). If
it is not swept up, the next run repeats `repo-hygiene` and the rotation silently stops.

**This breadcrumb**, written to the dev tree at the tracked path in the heading. It is UNTRACKED until
a board PR commits it — Station 00 sweeps it up. A breadcrumb filename matches no watcher glob, so
leaving it here arms nothing.

**Two scratch capture files**, outside the repo and outside any queue:
`C:\po-sup-fix-scripts\sweep-04-20260917.txt` and `C:\po-sup-fix-scripts\triage-04-20260917.txt`.

**Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No branch created or deleted.
No worktree pruned. No PR opened, labelled or merged. No file under `sot/`, `apps/`, `scripts/` or
`.github/` touched.

## FINDINGS

### F1 — The 2026-09-14 "eighteen unpushed commits" escalation is SPENT: both worktrees are gone and both PRs merged. But discharging the file as written would silently retire a live question it also contains.

`needs-marco/two-orphaned-worktrees-hold-eighteen-unpushed-commits-2026-09-14.md` asks Marco to
authorise pushing two orphaned worktrees' branches *before* anything is pruned, on the stated risk
that `po-fix1891` (14 commits) and `pr1823` (4 commits) hold *"eighteen commits that exist nowhere
else"* and that `git worktree remove` on either *"destroys the branch tip and the reflog that would
recover it, in one command, with no warning."*

**Measured above: the risk is discharged in full.** Both worktrees are absent from disk and from the
registry. #1823 merged 2026-09-11, #1891 merged 2026-09-14 as `5036c74c`, and both commit chains are
the pre-squash history of that shipped work. Both tip objects still resolve, and the negative control
exits 128, so the probe discriminates. Options (a), (b) and (c) in that file are all moot: there is
nothing to push and nothing at risk.

⚠️ **The file's own falsifying probe cannot fire as written, and that is the reason it is still open.**
It says *"if either of the two named worktrees ever returns 0 unpushed commits, this escalation is
spent."* Both return neither 0 nor a number — they return **absent**, which the probe has no branch
for. A reader running it literally gets an error rather than a verdict, files `[CANNOT MEASURE]`, and
the escalation survives another cycle. Three days of that have already elapsed.

🔴 **The part that must NOT be discharged with it.** The same file carries a second, explicitly
separable question: *"should `status-sweep.ps1` count unpushed commits as well as dirty files when it
prints its prune warning? … the warning as written is actively misleading, and that is the part that
will bite again."* That is still true and still unfixed — `po-vg` is flagged today on `dirty=1` alone,
and a `dirty=0` orphan holding commits would still read *"safe to prune"*. Moving the file to
`discharged/` retires the answered prune question **and** this unanswered instrument question in one
move, which is exactly how this pipeline loses findings.

**RULE 1, complete-and-additive first:** split before discharging — file the `status-sweep.ps1`
unpushed-commit-count question as its own item (it is a `scripts/` change, stageable by 00 once
Marco answers, and needs no prune decision), *then* move the worktree file to
`needs-marco/discharged/` with a one-line note recording that its 18 commits were pre-squash history
of #1823 and #1891. Alternative (b), discharge the whole file now: fails the *future* half — the
misleading warning survives with nothing naming it. Alternative (c), leave both: fails the
*immediately* half — a spent escalation in `needs-marco/` is re-read and re-measured by every run
that censuses that folder, which is what this run just spent its budget doing.

**DISPATCHED** — to Station 00, which owns `needs-marco/` triage and the `discharged/` move. I am
read-only on the board and may not move it. The measurements it needs are above; the split is the ask.

### F2 — 447 local branches in the dev tree against 15 heads on the remote, and `git branch -r` reports 54.

[MEASURED] `git ls-remote --heads origin` → **15** · `git branch -r` → **54** · `git branch` → **447**.
POSITIVE control `refs/heads/main` in the `ls-remote` output → 1; NEGATIVE control → 0.

This is DOCTRINE §9.2's trap standing live in the dev tree: `git branch -r` reads the local
remote-tracking cache, `fetch` without `--prune` never deletes a tracking ref, and §9.2 further
records that `--prune` cannot cure it because `refs/remotes/` can hold refs no refspec owns. **39
remote-tracking refs and ~432 local branches now name work that is merged, closed or abandoned.**
Named examples confirmed merged this run: `feat/ea-gate-reporting-team-permission` (#1823, merged
2026-09-11), `chore/retire-seven-spent-holds` (#1776, merged 2026-09-07). `preserve/pipeline-heartbeat`
is a one-commit local branch that was never pushed and whose content is now redundantly held at
`C:\po-sup-fix-scripts\PRESERVED-…`.

⚠️ **Blast radius is instruments, not disk.** Any run that reasons about branches from `git branch` or
`git branch -r` — rather than asking the remote — is reading a 447-row or 54-row answer to a 15-row
question. §9.2 also records that `git branch -r --merged origin/main` is blind to squash merges, which
is every merge in this repo, so the obvious cleanup filter is itself unsound.

**DEFERRED** — real, not now. Deleting refs is cheap locally but it is still deletion, the corpus is
large enough that a bulk pass is exactly the *"no agent bulk-deletes"* case the rotation entry names,
and nothing is currently broken by it: every instrument DOCTRINE prescribes already tells you to ask
the remote. **What would make it urgent:** a run filing a branch finding off `git branch -r`, or the
count reaching a point where `ls-remote` cross-referencing becomes the slow step in a station run.

### F3 — Seven of thirty-five HOLD prompts are SPENT: their work has already shipped, and they sit in the arming surface.

[MEASURED] `triage-holds.ps1` exit 0, `spent=7 of 35 evaluated`, with the script's own SPENT fixture
control PASSING (lint-prompt.mjs exit 3 reachable — the positive control §7 requires):

```
pr-crmvis-s2-relationships-HOLD.md
pr-crmvis-s3-account-360-HOLD.md
pr-crmvis-s4-register-HOLD.md
pr-ratescol-s3-add-in-grid-HOLD.md
pr-ratescol-s4-import-creates-columns-HOLD.md
pr-scopecards-s1-operational-costs-priced-HOLD.md
pr-scopecards-s2a-quote-destination-api-HOLD.md
```

Corroborated on a second, independent angle for the five that carry one: every `_V<n>` marker in those
prompts resolves to real files on `origin/main` — `CRM_PARITY_RELATIONSHIPS_V1` 1 file ·
`CRM_PARITY_ACCOUNT360_V1` 2 · `CRM_PARITY_REGISTER_V1` 5 · `CRM_REGISTER_V3` 3 ·
`SCOPE_OPERATIONAL_COSTS_PRICED_V1` 19 · `SCOPE_QUOTE_DESTINATION_V1` 22 (POSITIVE control
`CRM_PARITY_REGISTER_V1` → 5; NEGATIVE control, the minted needle → 0). Two —
`pr-ratescol-s3-add-in-grid` and `pr-ratescol-s4-import-creates-columns` — carry **no marker at all**,
which is DOCTRINE §10.6's measured "only 4 of 40 carry one"; for those the premise (lint exit 3) is the
prescribed instrument and the only one available.

⚠️ **Why it matters that they are still at depth 1.** A SPENT HOLD is `ADMIT`-adjacent noise in the one
surface an arming decision reads. DOCTRINE §10.6 records the cost from the other side: a spent prompt
that nothing retires is an armable duplicate of shipped work.

**RULE 1:** retire all seven to `docs/pr-prompts/superseded/` by `git mv` in one board PR —
complete (they leave the arming surface permanently) and additive (nothing is deleted; §8.5's *"nothing
is ever deleted, retiring a prompt means moving it"*). **The precedent is exact and merged:** PR
**#1776** (2026-09-07) did this for a different seven, as seven `R100` renames.

**DISPATCHED** — to Station 00. The move is a board mutation and 04 is read-only; 00 already does
exactly this in its collect PRs.

### F4 — Three remote branches whose work is fully landed have not been deleted; nine closed-unmerged ones must NOT be.

[MEASURED], from the 14-row table above:

- **Landed, branch still present:** `chore/sweep-breadcrumbs-20260907-0934` (#1778, merged
  2026-09-07, 227 behind / 5 ahead) · `docs/st00-collect-2026-09-14-1108` (#1927, merged 2026-09-14,
  74 behind / 2 ahead) · `fix1483` (**no PR of its own**; the work is #1483, merged 2026-09-02, and all
  four of its files plus `SCOPE_WBS_TABLE_V1` and `docs/decisions/merge-approvals/1483.md` resolve on
  `origin/main`).
- **Closed unmerged, 9:** `#1871 · #1612 · #1960 · #1978 · #1703 · #1707 · #1708 · #1705 · #1571`.

🔴 **The nine are not cleanup candidates and this finding says so explicitly**, because a census like
this one is how they get swept. `needs-marco/pr-1612-closed-unmerged-branch-holds-the-only-copy-2026-09-05.md`
names that exact hazard for `feat/crm-account360-v2-s1`, which is one of the nine and is still on the
remote today. Four more are the `*verdict-home-resolver*` kill-loop duplicates DOCTRINE §9.5 records.
A closed-unmerged branch may be the only copy of its work; deleting one is irreversible.

**ESCALATED** — to Marco, one sentence unblocks the safe half. Deleting a remote ref is irreversible
(DOCTRINE §5.4) and therefore not a station's. **RULE 1, complete-and-additive first: (a) delete only
the three whose content is provably on `main` — #1778, #1927 and `fix1483` — each verified by its
merged PR, and leave all nine closed-unmerged heads standing.** That solves it immediately and in
future (the same merged-PR test works for every later branch) and damages nothing, because the content
is on `main` by definition. **(b)** Delete nothing and keep reporting: fails the *future* half — the
head count grows and each census re-pays for the classification. **(c)** Prune everything not open:
fails the *do not damage* half outright — it would take the nine with it, including #1612's, which an
open escalation says may hold the only copy.

### F5 — The single duplicate flag on today's arming surface is a FALSE POSITIVE, settled on the marker.

`triage-holds.ps1` flagged `pr-scopecards-s3-line-markup-all-types-HOLD.md` as a POSSIBLE DUPLICATE of
open **#2002**, overlap **1 of 21**, on the sole shared scope entry
`apps/api/prisma/migrations/**` — a **directory** entry, which is precisely the case DOCTRINE §10.6
measures as *"precision zero by construction"*.

[MEASURED] `gh pr view 2002 -R <owner>/<repo> --json title,body` → exit 0, body 2824 chars;
occurrences of `SCOPE_LINE_MARKUP_ALL_TYPES_V1` → **0**. POSITIVE control, the word `transport` in the
same body → **8** (so the body was fetched and is searchable); NEGATIVE control, the minted needle in
the same body → **0**. Confirmed on the marker the prompt asserts, never on the head branch
(`feat/rates-tc-column-order`), which DOCTRINE §10.6 measured that prompts assert nowhere.

**#2002 is not this prompt's work.** The other gate-satisfied prompt, `pr-queue-layout-sot-entry-HOLD.md`,
carried no flag.

**DISPATCHED** — to Station 00, which is the only station that arms. This is an input to an arming
decision, not an arming decision; the flag is cleared, and ADMIT remains necessary but not sufficient
(read the body for a prose human gate, which no grep sees).

### F6 — Three HOLD prompts are tracked on `origin/main` but deleted from disk, and one of the three has already merged.

[MEASURED] `git status --porcelain` in the dev tree:

```
 D docs/pr-prompts/pr-crmvis-s5-followups-HOLD.md
 D docs/pr-prompts/pr-queue-layout-s1-the-standard-HOLD.md
 D docs/pr-prompts/pr-transport-capacity-column-order-HOLD.md
```

These are genuine uncommitted deletions, not §9.2's behind-tree artefact: the dev tree is `0 0`
against `origin/main`, so a ` D` here answers a question about `origin/main` as well as about `HEAD`.
It is also the whole of the 38-tracked against 35-on-disk gap in the depth-1 census above.

Their state on the board: `pr-queue-layout-s1-the-standard` → **#1999, MERGED 2026-09-17T09:29Z**
(the QUEUE_LAYOUT_V1 standard); `pr-crmvis-s5-followups` → **#1998 OPEN**;
`pr-transport-capacity-column-order` → **#2002 OPEN**. So the watcher consumed all three correctly and
the deletions simply have not been committed yet — but the first is now literally a *HOLD file tracked
on `main` whose work has shipped*, the named target of this sweep.

⚠️ **The hazard is the board trap's sibling, and §4 of the station doc names it:** a tracked prompt
whose removal is never committed comes back on any checkout. These are `-HOLD.md` rather than
`-ready.md`, so nothing re-arms on a checkout — which is why this is a hygiene item and not an S2.

**DISPATCHED** — to Station 00, to commit the three deletions in its next board PR (its own lane, and
the deletions are already staged in the working tree). 04 may not commit.

### F7 — The watcher clone holds 77 stashes, up from the 71 recorded seven days ago.

[MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` → **77**; dev tree → **1**. DOCTRINE
§9.5 records 71 in the clone on 2026-09-10 and flags the number as state to re-measure; this is the
re-measurement, and the trend is **+6 in seven days**.

DOCTRINE §9.2 explains the mechanism: the launcher's preflight stashes on every start and nothing ever
pops, so this is a closed loop, and §9.5 adds that a dirty tracked clone now auto-stashes rather than
refusing — the 77 stashes are that path's receipts. **Nothing is broken by it today:** the clone's
tracked tree is clean (`--untracked-files=no` → EMPTY, measured above), the watcher is RUNNING pid
30248, and no start has been refused.

**DEFERRED** — the cure is `git stash drop`, never `pop` (§9.2), the clone is Station 03's tree, and
04 is report-only on the machines. **What would make it urgent:** a stash-apply failure in the
launcher preflight, which is the one path on which a refusal still survives.

### F8 — `po-vg` has now been parked for thirteen days on a question only Marco can close, and its destroy-risk is discharged three times over.

[MEASURED] `C:/PR-Master/worktrees/po-vg`, branch `fix/no-rebase-while-checks-run` at `23c91ba9`
(2026-09-04, *"fix(pr-watcher): never rebase a PR whose checks are still running"*), 418 behind / 1
ahead of `origin/main`, one untracked file, age ~13.1 days, **no lock of any kind**. The branch is on
no remote: `git ls-remote --heads origin | Select-String 'no-rebase'` → 0, against the positive control
`refs/heads/main` → 1 and the minted negative → 0.

**Everything substantive about it is already settled in its own file.**
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md` was REFUTED in place on
2026-09-06: the guard and its 88-line test reached `main` as **#1577** on 2026-09-04, so options 1–3
are moot and the file says *"DO NOT push `fix/no-rebase-while-checks-run`"*. That refutation's
re-open condition — `git diff --numstat origin/main 23c91ba9 -- scripts/pr-watcher/index.mjs` returning
non-empty — is **not** met: `main` still has the guard.

The one live sentence in that file is that **pruning is irreversible and therefore Marco's.** Its
stated precondition is met and then some: the untracked file is held at
`C:\po-sup-fix-scripts\PRESERVED-po-vg-check-pipeline-heartbeat-2026-09-05.mjs` (6144 B, hash
`9c4587fb`, byte-identical to the worktree copy) **and** on the local branch
`preserve/pipeline-heartbeat`. Two independent copies outside the worktree.

**ESCALATED** — to Marco, and it is a one-sentence question, not a status update. **RULE 1,
complete-and-additive first: (a) prune the `po-vg` worktree and keep the branch ref
`fix/no-rebase-while-checks-run`.** `git worktree remove` does not delete a branch, the untracked file
is held twice elsewhere, the commit's content is already on `main` via #1577, and the registry stops
carrying a thirteen-day orphan that every sweep re-reports — complete and additive, nothing lost.
**(b)** Prune with `--force` and drop the branch too: fails the *do not damage* half needlessly — the
ref costs nothing and is the last handle on the commit object. **(c)** Leave it: fails the *future*
half — this is the fourth station run to measure it, and the sweep will keep printing *"HOLDS
UNCOMMITTED WORK … `--force` would discard it"* about a file that is safe.

### F9 — QUEUE_LAYOUT_V1 landed this morning and four of its five folders do not exist yet, while eight breadcrumbs sit tracked in the queue root.

[MEASURED] `superseded/` 444 · `archive/` 791 · `needs-marco/` 204 · `needs-marco/discharged/` 68,
against `merged/` **ABSENT** · `brainstorm/` **ABSENT** · `draft/` **ABSENT** · `exceptions/`
**ABSENT** · `reports/` **ABSENT**. At depth 1, 8 of the 54 tracked files are station breadcrumbs
(6× `00-00-supervisor-2026-09-17-*`, 2× `00-04-scanner-2026-09-17-*`), which DOCTRINE §8.5 assigns to
`docs/pr-prompts/reports/`.

**This is not drift, and the finding exists to stop it being read as drift.** §8.5 states the standard
*"is written in S1 and enforced in S4"* and closes with **"Not yet enforced."** S1 landed as **#1999**
at 09:29Z today, about forty minutes before this run started. A station censusing the queue against the
standard now on `main` will find five missing folders and a root full of reports, and the available
conclusion — *"the layout standard has been ignored"* — is wrong.

⚠️ What is worth saying once: the breadcrumb path in the report contract every station doc carries is
still `docs/pr-prompts/00-<NN>-…` at depth 1, so the two documents now disagree about where a
breadcrumb goes. **This run followed the station contract**, as the heading path shows, because the
contract is the layer that binds a station and §8.5 itself says the standard is unenforced. If S4
migrates the root without updating the canonical station-contract block, every station will keep
writing to the old path.

**DEFERRED** — the S4 slice is the fix and it is already scoped. **What would make it urgent:** S4
landing an enforcement gate before the canonical station-contract block is updated in the same PR, at
which point every station's breadcrumb write starts failing CI.

## WHAT I DID NOT DO

**I did not stage a prompt, and the rotation entry invited one** (*"REPORT ONLY - stage a prompt for
anything worth deleting"*). The obvious candidate was F3's seven-HOLD retirement. I dispatched instead,
for a stated reason rather than a shrug: PR #1776 shows Station 00 performs this identical move as
seven `git mv` renames inside an ordinary collect PR, so a staged `-HOLD` would add a queue file, a
lint cycle and a full agent build to a change 00 makes in one commit — and a malformed prompt in the
arming surface costs more than the dispatch saves. F1, F4 and F8 are all irreversible or Marco's by
DOCTRINE §5.4 and are not stageable at all. Budget used: 0 of 2.

**I did not arm, disarm, rename, move or delete any prompt**, including the seven SPENT ones in F3 and
the two gate-satisfied candidates. Arming is Station 00's on Marco's authority; the authority matrix
gives 04 *Mutate the board: NO, read-only*.

**I did not prune the `po-vg` worktree, delete any branch, or drop a stash.** All three are
irreversible or belong to Station 03's trees. F4 and F8 are escalations precisely because the actions
are not mine.

**I did not commit `docs/pipeline/sweep-rotation.json`**, though I advanced it. The dev tree is on
`main` and nobody commits to `main` directly; the file is named under WHAT CHANGED so 00 sweeps it up.

**I did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station
contract is explicit that ONE named sweep per run, covered completely, beats a shallow pass over
everything, and `next-sweep.mjs` assigned `repo-hygiene`. Selecting a second sweep would narrow
coverage without rotating it. I did read the board — 2 open PRs, both RED, trunk green — as sweep
context for the branch classification, not as a Part 1 audit.

**I did not write to `docs/qa/qa-findings.md` or any other gitignored sink**, and I did not read
`qa-checklist.md`, which is gitignored and absent. Every finding above is in this tracked breadcrumb.

**I did not dispatch the sweep's `watcher clone: dirty=3` warning to Station 03.** I re-derived it
(both `git status` forms in one call, 3 against EMPTY) and it is DOCTRINE §9.5's known false warning.
Archived runs have mis-routed that line thirteen times; this run did not add a fourteenth.

**I did not touch Azure, Entra or SharePoint**, did not write production data, did not edit `sot/`,
and did not remove a `do-not-merge` label or merge anything.
