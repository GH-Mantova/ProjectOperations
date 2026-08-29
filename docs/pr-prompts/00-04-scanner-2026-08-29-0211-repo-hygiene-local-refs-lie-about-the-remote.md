# Station 04 - Scanner | 2026-08-29T02:10Z-2026-08-29T02:35Z

## GROUND

```
UTC            2026-08-29T02:10:34Z
origin/main    873b3ef6            (fetched, then rev-parse)
dev tree       main @ 1501d09c     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. Full authority run.

SIGHTED, not blind: `start_process` shell `powershell.exe` returned PID 21900 and a live clock
(`2026-08-29T02:10:34.98Z`). Desktop Commander present. Sweep taken: **repo-hygiene**
(`node scripts/pipeline/next-sweep.mjs` -> "SWEEP: repo-hygiene", rotation position 3 of 4,
previous run 2026-08-28T22:10:26Z).

Reachability note, worth recording because it refutes a claim still live in the docs:
this station DOES appear in the scheduled-task listing and it reached the box anyway.
`STATION-CAPABILITIES.md` section 2 says "if a station appears in `list_triggers`, it is
cloud-fired and **will be blind**". That is a second independent refutation of the same line
Station 03 refuted on 2026-08-28 (00's dispatch #3 to fix it is already open). [MEASURED]

## WHAT I MEASURED

`status-sweep.ps1` ran clean: both section-0 positive controls [LIVE] (gh reached GitHub and
saw #1387; node runs), no [BROKEN], VERDICT **SAFE TO ACT**, exit 0. Cross-checked its own
key numbers directly rather than quoting them: armed 0, OPEN PRs 0, git processes 0,
`index.lock` false in both trees. Watcher node RUNNING pid 26364, wrapper alive.

**The board trap: CLEAN.** `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` returned
**527** paths - this is the POSITIVE CONTROL against the DOCTRINE 9.2 trap where a missing `-r`
returns exactly one line and any filter over it reports zero. Of those 527: tracked depth-1
`*-ready.md` = **0**; tracked depth-1 `*-HOLD.md` = **83**; tracked depth-1 `*.md` = 221.
On disk the dev tree carries 84 depth-1 HOLDs. The single-file discrepancy reconciles exactly:
`pr-doctrine-s9-gh-vs-git-waiver-HOLD.md`, my own untracked staging from 2026-08-28T22:10Z. [MEASURED]

**Watcher clone stashes: 51, and FLAT.** Newest is `watcher-preflight-autostash` at
2026-08-29T00:42:55+10:00 = **2026-08-28T14:42Z**, ~11.5 h before this run; nothing has been
stashed since, consistent with the standing OAuth block halting all agent runs. Oldest is
`stash@{50}`, a genuine `WIP on feat/sharepoint-folder-mappings`. Dev tree carries 11 stashes.
The closed loop (launcher stashes on every start, nothing pops) is confirmed but is not
currently growing. `drop`, never `pop`. [MEASURED]

**No worktree lock anywhere.** The dev tree's `.git\worktrees` holds 4 admin dirs; on every one
of them `locked` is absent and `index.lock` is absent. The watcher clone has **no**
`.git\worktrees` directory at all. So the DOCTRINE 7 hazard "an orphan's lock has no process by
construction, forever" is NOT present today. [MEASURED]

**Local branch count in the shared dev tree: 339.** [MEASURED]

**`check-breadcrumb.mjs` exit 0, CLEAN, 90 checked / 0 malformed / 7 skipped as pre-contract.**
Run from `C:\ProjectOperations2` with `git` on PATH. [MEASURED]

**Instrument preconditions, checked BEFORE believing any lint verdict** (my own 2026-08-28T22:10Z
finding: the silent gate-waiver is `git`, not `gh`): `git` resolves to
`C:\Program Files\Git\cmd\git.exe`, `gh` resolves to `C:\Program Files\GitHub CLI\gh.exe`. Both
present, so no gate was silently waived in any lint result below. [MEASURED]

**Three instrument self-corrections this run.** Recording them because a wrong probe that I then
corrected is more useful to the next reader than the corrected number alone:

1. I wrote a "negative control" comparing dev HEAD `1501d09c` to `origin/main` and expected
   exit 1. It returned exit 0. That is not an instrument failure - it is the honest answer that
   the dev tree is an **ancestor** of main, i.e. strictly behind, not diverged. My control was
   mis-designed. `git rev-list --count 1501d09c..origin/main` = **1**; ahead = **0**.
2. I measured "merged but not deleted" by intersecting the last 60 merged PRs against
   `git branch -r` and got **20 survivors**. That number is wrong - see F1.
3. I hypothesised that the unpushed `docs/sot-readme-fetch-plain1` commit still held an unlanded
   fix, because Marco's own project-instruction block still carries the disproved "web_fetch the
   blob URL, the raw CDN lags" advice. **REFUTED before I escalated it:** the branch's
   `sot/README.md` blob is byte-identical to `origin/main`'s (14842 B, same hash), and main
   already carries `?plain=1` in 10 places. The stale advice survives in the *scheduled-task and
   account-skill layers*, not in `sot/`. [MEASURED]

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` advanced: `last_index` **1 -> 2**, `last_run_utc`
  **2026-08-28T22:10:26Z -> 2026-08-29T02:11:07Z**. Read back from the file on disk after
  writing, not inferred from the command's exit. Next Station 04 sweep is **instruction-drift**.
  The file is ` M` and UNCOMMITTED - **Station 00 must commit it WITH this breadcrumb**, or the
  next run repeats repo-hygiene and the rotation silently stops.
- Three read-only diagnostic scripts written to `C:\po-sup-fix-scripts\` (sanctioned scratch,
  outside the repo): `04-hygiene-2026-08-29-0211.ps1`, `-b-`, `-c-`, `-d-`.
- **Nothing else.** No prompt armed, disarmed, renamed, moved or deleted. No PR touched. No
  `/sot/` file touched. `git diff --cached --name-status` was empty before and after - the
  shared index was clean throughout and I staged nothing into it.

## FINDINGS

### F1 [S2] `git branch -r` over-reports the remote by 25 dead refs. Three branch-hygiene instruments gave three different answers; only `ls-remote` was true.

The sweep brief asks for "branches merged but not deleted". Three ways to measure it, all run:

| Instrument | Answer | Verdict |
|---|---|---|
| `git branch -r --merged origin/main` (minus main/HEAD) | **0** | right number, wrong reason |
| last 60 merged PRs intersected with `git branch -r` | **20** | **WRONG** |
| last 100 merged PRs intersected with `git ls-remote --heads origin` | **0** | true |

- `git branch -r` (excluding HEAD) returns **47**. `git ls-remote --heads origin` - which asks
  the server - returns **22**. **25 remote-tracking refs point at branches that no longer exist
  on GitHub.** Nobody has run `git fetch --prune`. [MEASURED]
- My 20 "survivors" were all stale refs. Re-run against `ls-remote` over a *wider* sample (100
  merged PRs, not 60) the count is **0**. Positive control: the intersection instrument does
  produce hits (`remoteReal` contains `main` = True). [MEASURED]
- `--merged` returning 0 is not evidence of anything. This repo **squash-merges**, so a merged
  branch tip is never an ancestor of main and `--merged` is structurally incapable of returning
  non-zero here. It agreed with the truth today by construction, not by measurement. Anyone who
  trusts it on a repo that *does* merge-commit will get a real answer; here it is a coin that
  always lands the same way.

**Consequence, and it is the good news:** branch deletion on merge IS working - there is no
merged-but-not-deleted litter on the remote. The litter is 25 dead refs in the dev tree, and any
future branch-hygiene audit built on `git branch -r` will be wrong by more than 2x.

Cure: `git fetch --prune` in the dev tree. It touches only `refs/remotes/`; it does not touch the
working tree or the index and cannot resurrect a consumed prompt. My lane is read-only on the
board, so I report rather than run it. Worth adding to DOCTRINE 9.2 as two named traps
(`branch -r` staleness; `--merged` under squash) - I did not author that edit this run because
9.2 is inside the `instruments v2` CANONICAL-BLOCK and editing it requires re-recording the
block hash and shipping all six station docs together.

**DISPATCHED** - to Station 00: run `git fetch --prune` in `C:\ProjectOperations2`, and decide
whether the two DOCTRINE 9.2 additions are worth a canonical-block re-hash.

### F2 [S3] `check-breadcrumb.mjs` flagged 5 breadcrumbs UNTRACKED. Two of the five are on `origin/main`. It resolves tracking against the local tree.

`check-breadcrumb.mjs` exited 0 CLEAN and emitted five `NOTE ... is UNTRACKED - it reaches
nobody until a board PR commits it` lines. Checked each against the authority with
`git cat-file -e origin/main:<path>`:

```
ON-MAIN            00-00-supervisor-2026-08-28-2009-...md          exit=0
ON-MAIN            00-00-supervisor-2026-08-28-2209-...md          exit=0
ABSENT-FROM-MAIN   00-00-supervisor-2026-08-29-0008-...md          exit=128
ABSENT-FROM-MAIN   00-00-supervisor-2026-08-29-0208-...md          exit=128
ABSENT-FROM-MAIN   00-03-machine-minder-2026-08-28-2302-...md      exit=128
ABSENT-FROM-MAIN   00-04-scanner-2026-08-28-2210-...md             exit=128
POSITIVE CONTROL   origin/main:docs/pipeline/DOCTRINE.md           exit=0
NEGATIVE CONTROL   origin/main:docs/pr-prompts/zz-no-such-file.md  exit=128
```

Both controls behaved. **Two of the five UNTRACKED notes are false.** [MEASURED]

**Mechanism, which is the part worth keeping:** the dev tree is exactly **1** commit behind
`origin/main`. #1387 merged at 22:17Z and landed precisely those two breadcrumbs; the dev tree
never fast-forwarded. So *the number of false UNTRACKED notes equals the number of breadcrumbs
in the commits the dev tree is behind by.* A tree 5 commits behind produces five times this
noise, and it always errs toward over-reporting staleness - the direction that causes a reader
to redo finished work.

This is the same defect class as the `--freshness` bug already dispatched to Station 06
(it reports a false `UNTRACKED` for breadcrumbs that ARE on `origin/main`). This is a second,
independent confirmation with the mechanism named. One fix covers both halves: resolve with
`git cat-file -e origin/main:<path>`, not against the working tree.

**The true sweep-up list is FOUR breadcrumbs, not five and not three:** 00's 0008Z, 00's 0208Z,
03's 2302Z, 04's 2210Z - plus this one, making five for the next board PR.

**DISPATCHED** - to Station 06 (fold into the existing `--freshness` fix; same one-line cure,
same function) and to Station 00 (the sweep-up count is four plus mine, and the dev tree wants a
fast-forward).

### F3 [S3] `docs/pr-prompts/no-pr-opened/` is STILL not gitignored. I reported this on 2026-08-25. Four days, unfixed.

Prior report: `00-04-scanner-2026-08-25-0210-no-pr-opened-unignored-and-a-near-miss.md`
(tracked on main, `check-breadcrumb` lists it ADMIT). Re-measured today, not re-asserted:

```
git check-ignore -v docs/pr-prompts/no-pr-opened/x.md   -> exit 1   NOT IGNORED
POSITIVE CONTROL processed/   -> .gitignore:76  exit 0
POSITIVE CONTROL failed/      -> .gitignore:77  exit 0
POSITIVE CONTROL needs-marco/ -> .gitignore:82  exit 0
nested .gitignore inside no-pr-opened/: 0
```

`.gitignore:75-82` reads `docs/pr-prompts/*-ready.md`, then `processed/ failed/ paused/ blocked/
awaiting-review/ reviewed/ needs-marco/`. **`no-pr-opened/` is simply absent from that list.**
And `.gitignore:75`'s `*` does not cross a `/`, so it covers depth 1 only - which is exactly why
the consumed ready-files one level down slip through. [MEASURED]

Exposure, measured rather than assumed:
`git ls-files --others --exclude-standard -- docs/pr-prompts/no-pr-opened/` = **10 files, 9 of
them named `*-ready.md`** (`pr-ci-cache-playwright-browsers-ready.md`, `pr-comms-hub-inbox-ready.md`,
`pr-crm-leads-s6-reason-admin-settings-ready.md`, `pr-e2e-container-s1-trial-workflow-ready.md`,
`pr-field-location-provider-seam-ready.md`, `pr-rates-consumers-s2-tendering-ready.md`,
`pr-rates-consumers-s3-persona-export-ready.md`, `pr-rates-drop-prompt-corrections-ready.md`,
`pr-rates-s11c-drop-legacy-tables-ready.md`, plus `rev-1250-SKIPPED-...md`). The folder holds 107
files; the other 97 are caught by unrelated `*.log` / report patterns. [MEASURED]

Blast radius, stated precisely so it is not overstated: a pathspec-less `git add -A` in the
shared dev tree publishes 9 consumed prompts to main. At **depth 2** they will NOT arm - the
watcher globs `*-ready.md` at depth 1 only - so this is permanent contamination of main, not a
re-arm. That is why it is S3 and not S2. One of them is
`pr-rates-s11c-drop-legacy-tables-ready.md`, a destructive table-drop prompt, which is reason
enough not to leave it lying where a careless `add -A` can reach it.

RULE 1 - complete and additive, and there is no second option worth writing:
**add one line, `docs/pr-prompts/no-pr-opened/`, after `.gitignore:82`.** It solves the case
immediately and permanently for every future consumed prompt; it adds an ignore rule and deletes
nothing; the 10 files stay on disk where the watcher put them; no existing or future data entry
is affected. The alternative - deleting the 10 files - fails the second half: it destroys the
record of why nine prompts opened no PR.

I did NOT stage this as a `-HOLD` prompt, though my lane permits one. Reasoning stated so 00 can
overrule it: the OAuth block means any armed prompt currently dies `401 ... token has expired`
and lands in `failed/`, so a prompt is actively worse than a dispatch right now; and the queue
root already carries 84 HOLDs of which a recent census found 21 spent. A one-line `.gitignore`
edit routed through a breadcrumb 00 reads every 2 h lands sooner than an 85th HOLD.

**DISPATCHED** - to Station 00, with the exact edit above. If 00 prefers a prompt, the body is
this finding verbatim.

### F4 [S3] "orphaned worktrees: 4 ... investigate/prune" is a booby trap. Two are already landed; two carry `/sot/` commits only Station 05 can adjudicate.

`status-sweep.ps1` prints `orphaned worktrees: 4 (aborted run leftovers -- investigate/prune)`.
"Prune" is the wrong default. All four hold commits that exist **nowhere else**:

- `git ls-remote --heads origin` contains **none** of the four branch names. Positive control:
  `main` IS found. They were never pushed. [MEASURED]
- `git merge-base --is-ancestor <sha> origin/main` returns 1 for all four. Positive control:
  `origin/main` against itself returns 0. [MEASURED]
- OPEN PRs on the repo: **0**. Nothing is tracking this work. [MEASURED]

I first measured "files differing" as `git diff --name-only origin/main <branch>` and got
377/367/274/377. **That number is meaningless** - it is inflated by main's own drift since the
branch point, not by the commit's content. The honest measurement is the commit's own diff plus
a blob comparison:

| Worktree / branch | Committed | Its own commit | Verdict |
|---|---|---|---|
| `C:/po-worktrees/sot-readme-fetch` `docs/sot-readme-fetch-plain1` @904fa4e8 | 2026-08-24T01:00Z | 1 file `sot/README.md` | **blob byte-identical to main (14842 B, same hash). ALREADY LANDED. Prunable, zero loss.** |
| `C:/po-wt-h` `hygiene` @edef9f59 | 2026-08-20T08:25Z | 5 files | **4 of 5 ALREADY-ON-MAIN**; only `pr-sor-s9-register-to-progress-claim-HOLD.md` absent |
| `C:/po-worktrees/sot-d-register` `docs/sot-05-d-register` @407b93d2 | 2026-08-20T07:25Z | 1 file `sot/05-decisions-and-lessons.md` | DIFFERENT: branch 112745 B, main 73257 B |
| `C:/po-worktrees/sotk-03-ledger` `docs/sot-03-merged-pr-ledger-2026-08-24` @5db5a7c2 | 2026-08-24T14:19Z | 2 files incl. `sot/03-progress-log.md` | DIFFERENT: branch 635240 B, **main 635250 B (main is larger)** |

I deliberately do **not** claim the two `/sot/` branches hold content missing from main. A byte
delta measured across 5-9 days of main's own movement is not evidence of loss in either
direction - main being *larger* on `sot/03` suggests the branch is behind, not ahead. Deciding
this requires reading `/sot/`, which is Station 05's exclusive lane, and I did not read into it
to form a view.

What matters for hygiene: **these are unpushed, so deletion is unrecoverable.** No worktree lock
exists on any of them (F-measured above), so they are causing no active harm and there is no
urgency to prune.

**DISPATCHED** - to Station 05: adjudicate `docs/sot-05-d-register` and
`docs/sot-03-merged-pr-ledger-2026-08-24` - land the content via a doc-reconcile PR, or declare
them superseded and let 00 prune. `docs/sot-readme-fetch-plain1` is confirmed redundant and 00
may prune it now.

### F5 [S4] `pr-doctrine-s9-four-false-traps-LOOPING.md` re-verified SPENT, still at the queue root, still untracked.

Re-verified rather than carried forward from my 2026-08-28T22:10Z run, per the re-read rule:

```
node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-doctrine-s9-four-false-traps-LOOPING.md
STALE  Premise no longer holds. "The work is ALREADY DONE. Binned before spawning an agent."
exit 3
POSITIVE CONTROL  pr-doctrine-s9-gh-vs-git-waiver-HOLD.md -> ADMIT exit 0
```

The linter produced both outcomes in the same session, so exit 3 is a real verdict and not a
dead instrument. `git` and `gh` both resolve, so no file-gate was silently waived. [MEASURED]

It belongs in `docs/pr-prompts/superseded/`. Moving it is a board mutation and outside my lane.
It is also currently **untracked**, so it can be moved without a rename showing in the index.

**DISPATCHED** - to Station 00: move to `superseded/`.

### F6 [S4] 339 local branches in the shared dev tree.

`git branch --format="%(refname:short)"` returns **339**, against 22 branches that actually exist
on the remote. Many are long-dead arming scratch (`arm-f2c`, `ff598`, `chk538`, `tmp556`,
`pr465-temp`, `_tmpfix`). They are refs only: they cost no correctness, they keep objects alive,
and deleting them in bulk in a tree the watcher runs in is exactly the kind of careless
shared-tree action LL-38 records. [MEASURED]

**DEFERRED** - real, not now. It becomes urgent the moment any decision is driven off a
`git branch` listing (F1 shows that is not hypothetical - a branch listing already produced one
wrong answer this run), or if repo size becomes a problem. If 00 wants it cleared, it should be
one scoped prompt naming the branches, not a bulk delete.

### F7 [S2] The project-memory index is 23.9 KB against a 24.4 KB hard read limit, and its own header says the safe cuts are exhausted.

Not part of the repo-hygiene brief, but found while filing this run's memory entry and it is the
same failure mode as `docs/qa/qa-findings.md`: **a report channel that silently swallows what is
written to it.** Recording it here because the breadcrumb is the tracked channel and memory is not.

- Writing my (already compact, one-line) index entry took `MEMORY.md` to **24.7 KB**, over the
  **24.4 KB** hard read limit. **Everything past the limit is silently dropped when the index is
  loaded** - entries at the tail are already invisible to readers. I immediately collapsed my own
  entry to a pointer, bringing it to **23.9 KB**. [MEASURED, from the write hook]
- Station 00 ran a full compaction concurrently at **02:20Z** (the "28th compaction"), retiring
  only answered items. It still sits at 23.9 KB. Its header now states: *"The pre-declared MOVES
  are EXHAUSTED; the only one left ... saves header bytes only. Anything beyond that must retire
  an ANSWERED item, never trim a live one."* [MEASURED, read at 02:40Z]
- So: **~500 bytes of headroom, no safe cut left, and every station appends to it every run.** The
  next entry from any station overflows it again, and the loss is silent and at the tail - which
  is where the archive pointers and the older standing findings live.

This is not a compaction problem any more; compaction has been run to exhaustion. It is a
structural one, and the choice is Marco's or 00's, not mine. RULE 1, complete-and-additive first:

- **(A) Split the index into a hot index plus a cold archive index that is loaded on demand.**
  Solves it immediately and permanently regardless of how many findings accrue, and destroys
  nothing - every current line survives, it just lives behind one more pointer. Passes both halves.
- (B) Raise the read limit. Immediate and non-destructive, but not a permanent fix - it defers the
  same failure to a larger number. Fails the "future" half.
- (C) Keep retiring findings to hit 17.1 KB. Permanent in form only: it works by deleting live
  standing findings, which is precisely what the index header exists to forbid. **Fails the
  "without damaging existing data" half outright.**

**ESCALATED** - to Marco, via Station 00. Question: split the index (A), or raise the limit (B)?
Not a status update - the index is ~500 bytes from silently dropping its own tail, and no station
can fix that by writing more carefully.

## WHAT I DID NOT DO

- **Did not run `git fetch --prune`, `git worktree prune`, or delete any branch.** All three are
  board/repo mutations; my lane is read-only on the board and F1/F4 are exactly the findings
  where acting on a half-understood reading destroys unpushed work.
- **Did not stage a `-HOLD` prompt.** My lane permits one per run. Judged net-negative while the
  OAuth block stands - see the reasoning in F3. My previous run's staged
  `pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` is still at the queue root, untracked and unarmed,
  and still lints ADMIT.
- **Did not add the two new traps to DOCTRINE 9.2.** That section is inside the
  `instruments v2` CANONICAL-BLOCK; editing it requires re-recording the block hash and shipping
  all six station docs in one PR. Flagged in F1 for 00 to decide.
- **Did not read into `/sot/` to adjudicate the two orphan `/sot/` branches.** 05's exclusive
  lane; I measured blob sizes and hashes only.
- **Did not commit or push anything.** No branch, no PR. `git diff --cached --name-status` was
  empty before and after.
- **Did not touch the board, any prompt, any PR, the watcher, or anything Azure / Entra /
  SharePoint.**
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** One named
  sweep per run, covered completely, is the station rule; this run's sweep was repo-hygiene.
- **Did not re-raise** the standing OAuth block, the CP-26 ruleset question, the watcher clone's
  divergence, or the 17 consumed HOLDs tracked on main. All are open and none is new. The clone's
  dirty=35 and the 51 stashes are measured above and are unchanged, not deteriorating.

---

**This breadcrumb is UNTRACKED until a board PR commits it.** Station 00: sweep it up **together
with `docs/pipeline/sweep-rotation.json`**, which is ` M` and must land in the same PR or the next
Station 04 run repeats repo-hygiene and the rotation silently stops.

Four other breadcrumbs are genuinely absent from `origin/main` and want the same PR (verified by
`git cat-file -e origin/main:<path>`, NOT by `git status`, which is lying in this tree - see F2):
`00-00-supervisor-2026-08-29-0008-*`, `00-00-supervisor-2026-08-29-0208-*`,
`00-03-machine-minder-2026-08-28-2302-*`, `00-04-scanner-2026-08-28-2210-*`.
The 2009Z and 2209Z supervisor breadcrumbs are **already on main** (#1387) despite what
`git status` and `check-breadcrumb.mjs` say - do not re-land them.

Use a **pathspec-scoped** commit. The shared index was clean at 02:35Z but another chat may stage
into it at any moment.
