# Station 00 — Supervisor | 2026-09-07T03:08Z–2026-09-07T03:55Z

## GROUND

```
UTC            2026-09-07T03:08:49Z
origin/main    5e0e26b2            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 5e0e26b2     C:\ProjectOperations2   (opened at 5a824702, 3 behind; fast-forwarded — see WHAT CHANGED)
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Doc version and bootstrap AGREE. This run was NOT read-only-restricted on that account.

**SIGHTED.** Desktop Commander was loaded first (`ToolSearch` keyword `desktop-commander`, one call,
26 tool ids returned) and only then called. `start_process` shell `powershell.exe` succeeded on the
first attempt. The previous run (02:09Z) was blind; this one is not, and the difference is stated
because a blind run and a healthy quiet run produce the same silence.

**Device-bridge git guard, installed FIRST, before any VM-side call.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — last line, quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`,
preceded by `vm-git-guard installed at /sessions/jolly-vigilant-hopper/.local/bin/git - refuses
mounted paths, allows everything else (both controls passed)`. **INSTALLED.** No `git` command was
run through the mount at any point this run; every git call went through Desktop Commander.

**Which tree the binding documents were read in, and how their freshness was proved.**
`C:\ProjectOperations2`, the dev tree — never the watcher clone.
[MEASURED] `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` → **EMPTY output for
all three**, which DOCTRINE §9.1 names as the real answer. The working copies are therefore
`origin/main`'s and were read as such. **No piped hash was compared anywhere in this run** (§9.1:
`git show <ref>:<path> | git hash-object --stdin` is unsound under `powershell.exe`).

## WHAT I MEASURED

**Sweep, captured to a file so its own §7 verdict could be read** (it returns early and hides the
verdict when read inline). [MEASURED] `status-sweep.ps1` → 291 lines, generated 03:10:26Z. Section 0
controls **both PASS** (`gh CAN reach GitHub (saw merged PR #1755)`, `node runs`). Section 7:
**`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.`** Section 3: in-progress prompts **0**, `index.lock` interactive/clone **False / False**,
running git processes **0**, no PR touched in the last 2 min. Section 4: `armed (*-ready.md)` = **0**
— zero arms and zero review jobs.

**The watcher.** [MEASURED] from the same sweep: node **RUNNING pid 31660**, auto-restart wrapper
**alive (1)**, heartbeat age **5 min**. Watcher clone `branch=main dirty=3`. 🔴 **This is a sweep
reading, not a `restart-watcher-if-wedged.ps1` verdict** — I did not run that script, because
nothing this run required a liveness verdict (zero armed prompts, so there is no queue to be wedged
on). `[CANNOT MEASURE]` watcher wedged/healthy in the sanctioned sense; nothing below depends on it.

**The board, live.** [MEASURED] `gh pr list --state open --json
number,title,headRefName,mergeStateStatus,isDraft,labels,createdAt,author`, parsed in node (never
`--jq` with spaces, §9.4):

| PR | state | created | branch | labels |
|---|---|---|---|---|
| `#1756` | BLOCKED | 02:36:59Z | `feat/hygiene-s1-guarded-branch-prune` | none |
| `#1754` | BLOCKED | 02:36:06Z | `fix/triage-holds-spent-behind-a-reject` | none |
| `#1753` | BLOCKED | 02:35:47Z | `feat/pipeline-module-provenance-s1` | none |
| `#1746` | BLOCKED | 00:23:22Z | `feat/rates-plant-fuel-column` | **`do-not-merge`** |
| `#1740` | BLOCKED | 2026-09-06T23:02:21Z | `deps/puppeteer-25-remove-extract-zip` | none |

**Q1 — how many are DIRTY? ZERO.** All five read `BLOCKED`, which is a required-check state, not a
conflict. No PR on this board has frozen CI. **Q2** therefore does not arise: there is no conflict to
resolve and none to escalate.

**Q3 — armed prompts, counted myself, not quoted from a note.** [MEASURED]
`status-sweep.ps1` §4 `armed (*-ready.md): 0`, and `Get-ChildItem docs/pr-prompts -Filter *-ready.md`
agrees. **Zero.** Not five: the 02:11Z scanner run saw five and correctly read the NAMES —
`rev-1748…rev-1752`, all REVIEW JOBS (§9.5) — and all five have since been consumed. `armed=N` is
still not N arms.

**RULE 2 probe — live tree pinned, `rev-*` excluded, controls asserted.** [MEASURED] over
`C:\ProjectOperations2\docs\pr-prompts\processed` (the LIVE tree; **never** the
`C:\po-watcher\…\processed` decoy, whose positive control also passes and which then clears every PR
since 17 August). Pattern written without a quote character: `'marco.:true'`.

| PR | `pr-*.log` hits | verdict |
|---|---|---|
| `#1740` | **4** | carries a live `{"ok":false,"marco":true,…}` — **MARCO'S, at any greenness** |
| `#1746` | 0 | `NO LOG` → `[NO LANE VERDICT — hand-classified]`, below |
| `#1753` | 0 | `NO LOG` → `[NO LANE VERDICT — hand-classified]`, below |
| `#1754` | 0 | `NO LOG` → `[NO LANE VERDICT — hand-classified]`, below |
| `#1756` | 0 | `NO LOG` → `[NO LANE VERDICT — hand-classified]`, below |
| `#999999` | 0 | NEGATIVE control |

POSITIVE control: `marco.:true` present in **619** logs of **2032**. **Freshness precondition
asserted:** newest log in that directory by `LastWriteTimeUtc` is `rev-1755-ready.md.log` at
**03:06:40Z**, younger than the oldest open PR (`#1740`, created 2026-09-06T23:02:21Z). The probe is
live, pinned to the right tree, and calibrated in both directions.

**Hand-classification of the four `NO LOG` PRs (§10.1 steps 2–4).** [MEASURED] file lists via
`gh pr view <n> --json files`:

- **`#1746`** — `apps/api/prisma/migrations/…/migration.sql` + `apps/api/**`, and it carries the
  `do-not-merge` label. `classifyPolicyFiles` refuses any `(^|/)migrations/` path on its own clause.
  **MARCO'S, twice over.** Not mine at any greenness.
- **`#1753` · `#1754` · `#1756`** — each contains its own
  `docs/decisions/merge-approvals/<N>.md` receipt. That is the supervised cloud lane's signature
  (§10.2.1, and Marco's 2026-09-07 ruling *"the lane merges, but writes a receipt first"*). By
  `classifyPolicyFiles` alone all three are outside `tests|docs` — `scripts/pipeline/lint-prompt.mjs`,
  `scripts/pipeline/triage-holds.ps1`, `scripts/branch-prune.ps1`, `.vscode/tasks.json` — so absent
  the lane exception they would read as Marco's. **Either way they are not the scheduled lane's to
  merge, and I merged nothing.**

🔴 **I did NOT reach "second lane" from an absent `opened PR #<n>` line.** §9.5 records that test as
sound in ONE direction only. The evidence here is positive and independent: **all three PRs were
created inside 71 seconds** (02:35:47Z, 02:36:06Z, 02:36:59Z), and the single-lane watcher cannot
open three PRs in 71 seconds; each carries a receipt naming the lane; and [MEASURED]
`.arming-log.txt` is byte-equal to `origin/main` and records **no arm** in that window.

**#1756's red, read from the job log — never from the diff or the PR page.** [MEASURED]
`gh run view 34078546858 --job 101609292806 --log` → 1928 lines. `# pass 222`, `# fail 1`,
`##[error]Process completed with exit code 1.` The single failure:

```
not ok 21 - A: for-each-ref %(upstream:track) is the field that says [gone]
  location: 'scripts/pipeline/__tests__/branch-prune.test.mjs:316:1'
  error: |-
    Command failed: git branch weird|name.with-stuff
    fatal: cannot lock ref 'refs/heads/weird|name.with-stuff': Unable to create
    '...\refs\heads\weird|name.with-stuff.lock': Invalid argument
```

**Triage, re-measured by me at `5e0e26b2` — not quoted from the 02:11Z note.** [MEASURED]
`triage-holds.ps1`, exit 0, with its own controls PASSing (`GIT control: PASS -- git read
origin/main:docs/pipeline/DOCTRINE.md (114825 chars)`; `SPENT control: PASS -- lint-prompt.mjs
emitted exit 3 on the fixture`). **`spent=11 gates-satisfied=25 still-gated=32 unreadable=0 of 68`**
— the scanner measured **9 of 66** ninety minutes and two merges earlier. The two additions are
`pr-smoke-share-worker-tokens` (killed by `#1755`) and `pr-sweep-stale-check-retires-live-escalations`
(killed by `#1750`).

**Where the dev tree stood, and the shape of each dirty file.** [MEASURED] on entry: `HEAD 5a824702`
vs `origin/main 5e0e26b2`, `git rev-list --left-right --count HEAD...origin/main` → `0 3`.
`git diff --numstat`: `sweep-rotation.json 2/2`, `.arming-log.txt 1/0`, and two ` D` consumed HOLDs.
🔴 **The `.arming-log.txt` `1/0` shape is the append-only trap's signature, and this instance was
benign — but only a second probe could say so.** `git diff --numstat origin/main --
docs/pr-prompts/.arming-log.txt` → **EMPTY**: the extra line was already on `origin/main`, so the
working copy was not a strict superset of `main` and restoring it to HEAD destroyed nothing.
`git hash-object` disagreed with that reading (`2088bb58` against `origin/main`'s `98475c2a`), which
is the CRLF/clean-filter divergence §9.3 warns about — **`--numstat` EMPTY is the real answer** and
is what I acted on. Local copy saved to `C:\po-sup-fix-scripts\arming-log.LOCAL.txt` before touching
it regardless.

## WHAT CHANGED

1. **Fast-forwarded the dev tree, `5a824702 → 5e0e26b2`.** Both blockers cleared the documented way,
   with node writes, never `git checkout -- <path>` and never `git clean` (§9.2):
   `git show HEAD:docs/pipeline/sweep-rotation.json` and `…:.arming-log.txt` piped to a node write,
   after saving both local copies. `git merge --ff-only origin/main` → `Updating 5a824702..5e0e26b2`,
   12 files. **Read back all three, not just the first:** `git rev-list --left-right --count
   HEAD...origin/main` → `0	0`; `git diff --cached --name-status` → EMPTY; `git diff --numstat` →
   `sweep-rotation.json 2/2` plus the two ` D` HOLDs **and nothing else**. The rotation modification
   was then re-applied from its saved copy, deliberately, because it is 04's work and lands in this
   run's PR. `.arming-log.txt` needed no re-apply and reads EMPTY against `origin/main`.

2. **Pushed the fix for `#1756`'s only red onto its own branch.** Clean isolated worktree
   `C:\po-wt-1756` off `origin/feat/hygiene-s1-guarded-branch-prune`, one test file changed, torn
   down afterwards (`git worktree list` → dev tree + `C:/po-vg` only). Commit `d960ce9e`,
   `test(branch-prune): a pipe cannot be a refname on Windows`.
   **Read back twice:** locally on the Windows host before pushing,
   `node --test scripts/pipeline/__tests__/branch-prune.test.mjs` → **exit 0, tests 29 / pass 29 /
   fail 0 / skipped 0**; and after pushing, `gh pr view 1756 --json headRefOid` →
   **`d960ce9e9c7fb97528208f7d31c9e5d7ddc417da`**, i.e. the PR head is my commit.

3. **Retired 13 prompts to `docs/pr-prompts/superseded/`** in this run's board PR — the 11 measured
   SPENT plus the two consumed HOLDs described in F3. `git mv` for every one; read back that **0**
   remain at depth 1 and **13** are present under `superseded/`.

4. **Amended DOCTRINE §10.6** with the corrected `scope:` cross-check (F4). Edited in node by
   concatenation, never a `String.replace` replacement string (§9.3). **Byte delta asserted:**
   114825 → 117759, delta **2934**, expected **2934** — equal. A follow-up 38-byte correction removed
   an untracked repo path the linter refuses. `lint-station.mjs` → **exit 0, `ADMIT: all 8 docs
   clean`**, so the `instruments v2` canonical hash is untouched (my edit is outside that block).

5. **Collected and archived.** `00-00-supervisor-…-0108-…md` `git mv`'d into `archive/`; the 02:09Z
   supervisor breadcrumb and the 02:11Z scanner breadcrumb added directly under `archive/` (every
   finding in both now carries a disposition); 04's `sweep-rotation.json` advance committed, which 04
   may not do itself; and `pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate-HOLD.md`, staged by the
   blind 02:09Z run, committed so it stops living only on one machine's disk.

**This breadcrumb was written INSIDE this run's PR worktree** (the REPORT CONTRACT's preferred home),
so no loose untracked copy is left in the dev tree and the post-merge fast-forward cannot trip on it.

Nothing merged. Nothing armed. No label added or removed. No receipt authored.

## FINDINGS

### F1 — `#1756`'s only red is a pipe character that cannot be a filename on Windows

`branch-prune.test.mjs` test 21 creates a branch named with a pipe to prove the `0x1f` field
separator survives a delimiter-rich branch name. **Git accepts a pipe in a refname; Windows does not
accept one in a FILENAME**, so the loose ref `refs/heads/weird|name.with-stuff.lock` could never be
written and the test died **before it measured anything** — on every Windows run, while passing on
Ubuntu. A skip-guard is not available: `ci.yml` asserts `skipped == 0` for that job.

The assertion's intent and coverage are unchanged: the branch name still carries three characters a
person might plausibly have chosen as a delimiter, and every one of them is legal in a git refname
**and** in a Windows filename. A comment records why the pipe may not come back — the *future* half
of RULE 1, without which the next author reintroduces it.

⚠️ **The review lane had already reached the same cause**, in
`docs/pr-prompts/needs-marco/pr-1756-review-block.md`, ending *"Agent should fix the test name and
re-fire the prompt or open a fix PR."* I found it after reading the job log, not before, so this is
an independent confirmation rather than a repetition — and it is worth saying that the review lane's
diagnosis was correct and sat unactioned for an hour because nothing routes a `pr-<N>-review-block.md`
to anyone.

**DISPOSITION: ACTIONED.** Commit `d960ce9e` is the PR's head; the local Windows run of that test
file is exit 0, 29/29. CI on the new head was still in flight when this run ended — **if
`Pipeline — arm-prompt tests (Windows)` is green on `d960ce9e`, this is done; if it is red for a
different reason, that is a new finding, not a failed fix.**

### F2 — three PRs arrived from the supervised cloud lane in 71 seconds, and their prompts are still armable HOLDs

`#1753`, `#1754` and `#1756` were created at 02:35:47Z, 02:36:06Z and 02:36:59Z. Each carries its own
`docs/decisions/merge-approvals/<N>.md`. `.arming-log.txt` records **no arm** in that window, and the
single-lane watcher cannot open three PRs in 71 seconds. **This is §10.6 happening three times at
once:** a second lane never reads the queue, so it does not consume the prompt it built, and all
three prompts sit in the queue with their premises intact —
`pr-module-provenance-s1`, `pr-triage-holds-spent-behind-a-reject`,
`pr-hygiene-s1-guarded-branch-prune`. Two of them are in tonight's `ADMIT` bucket, which is exactly
where an arming decision goes looking.

**The premise dies on MERGE, not on OPEN.** For as long as those PRs are open, arming any of the
three opens a duplicate PR for work already on the board.

**DISPOSITION: DEFERRED.** All three are recorded here as DO-NOT-ARM-WHILE-OPEN and none was armed.
They need no prompt file and no code change — they retire themselves as SPENT the moment their PRs
merge, and the next run's `triage-holds.ps1` will show that. **What would make this urgent: any of
the three PRs being CLOSED UNMERGED**, at which point the prompt is the only surviving copy of the
work and must be re-armed deliberately rather than found by accident.

### F3 — the SPENT count is 11, not 9, and two prompts are structurally invisible to the tool that reports it

Station 04 measured `spent=9 … of 66` at `5a824702`. [MEASURED] at `5e0e26b2` it is
**`spent=11 … of 68`**, and the arithmetic is not a correction of 04 — two more prompts died in the
merges between the two readings.

🔴 **The part worth keeping is a blind spot neither reading names.** `triage-holds.ps1` globs the
**dev tree**, and two consumed prompts —
`pr-armguard-s1-refuse-when-a-prompt-is-already-armed-HOLD.md` (built into `#1742`, **merged**) and
`pr-deps-s2-puppeteer-major-drops-extract-zip-HOLD.md` (built into `#1740`, still open) — are ` D`
in the dev tree and therefore **invisible to every triage run**, while `origin/main` still carries
both. [MEASURED] `git diff --name-status origin/main -- docs/pr-prompts/` lists both as `D`.
**A clone, CI, or any station working from `origin/main` sees two armable prompts for work that has
already been built.** That is the "stays armable forever" defect, reached from the side where the
instrument cannot see it at all: the file's absence locally is what hides it.

**DISPOSITION: ACTIONED.** All 13 — the 11 SPENT and these two — are `git mv`'d into
`docs/pr-prompts/superseded/` in this run's board PR, which is the only place the deletion becomes
true for every reader. Read back: 0 at depth 1, 13 under `superseded/`. Two of the 11
(`pr-rates-unit-per-row-columns`, `pr-verdict-anchor-heading-form`) come off the standing never-arm
list by retiring rather than by being added to it.

### F4 — DOCTRINE §10.6's `scope:` cross-check failed in both directions on a four-PR board

Station 04's F2, verified against its own measurements and adopted. §10.6 tells a run to cross a
prompt's `scope:` entries against open PRs' file lists before arming. On the 02:1xZ board that test
produced five overlaps: **two real duplicates and three false positives**, and it **under-reported
the one class the section exists to protect** — `pr-rates-plant-fuel-column` scored 3/4 rather than
4/4 solely because one `scope:` entry is a **directory** (`apps/api/prisma/migrations/`) and an
exact-path set test can never match one. A full-match rule would have cleared a `gate_allow:
migrations` prompt — Marco's — for arming. In the other direction, three prompts sharing the single
scope entry `scripts/pipeline/status-sweep.ps1` all scored a perfect 1/1 against `#1750`; for a
one-file scope the test's precision is zero by construction.

**DISPOSITION: ACTIONED.** §10.6 now says: match a trailing-`/` scope entry as a **prefix**, and
treat any overlap ≥ 1 as a **CANDIDATE** to be confirmed by the prompt's own marker string — never
as a verdict in either direction. That is 04's option (a), the complete-and-additive one: it repairs
the under-report *and* defuses the over-report, damages no existing reading, and costs the reader one
extra field. Its falsifying probe is written into the section. Options (b) full-match-plus-special-
case and (c) match-on-head-branch were rejected — (b) fails RULE 1's *future* half, and (c) fails its
*complete* half, because §10.6 already measured that a prompt asserts no branch at all.

### F5 — 04 nominated an arming candidate that the cloud lane had already built ninety minutes earlier

Station 04's F3 dispatched `pr-triage-holds-spent-behind-a-reject-HOLD.md` to me as a clean arming
candidate: ADMIT, size 2, one read-only reporting script, no open-PR overlap. **Its dupe scan was
correct when it ran and false 25 minutes later** — `#1754`
(`fix/triage-holds-spent-behind-a-reject`, `SPENT_BEHIND_A_REJECT_V1`) was opened at 02:36:06Z, and
04's cross-check ran against a four-PR board that did not yet contain it.

This is not a defect in 04's work; it is `[LIVE]` meaning *"true when measured"*, on the one class of
reading where being 25 minutes stale converts a correct answer into a duplicate PR. **The general
rule it argues for: an arming candidate must be re-crossed against the board at the moment of
arming, never at the moment of nomination.**

**DISPOSITION: DEFERRED**, folded into F2 — not armed, and it will retire itself as SPENT when
`#1754` merges. What would make it urgent is the same trigger as F2: `#1754` closing unmerged.

### F6 — `#1740` and `#1746` are Marco's, and both are already escalated

`#1740` carries a live watcher `{"ok":false,"marco":true,…}` (4 prompt logs, POS 619 / NEG 0, probe
fresher than the PR). Its two remaining reds are `Approval receipt (CP-26)` and `PR gates — diff
checks` — one cause, two reds, on `RELEASED_NO_RECEIPT`, because `do-not-merge` was applied and
removed on 2026-09-06 with no `docs/decisions/merge-approvals/1740.md` ever committed. `#1746` is a
`migrations/` diff still wearing `do-not-merge`.

**DISPOSITION: ESCALATED — and the file already exists.**
`docs/pr-prompts/needs-marco/pr-1740-released-with-no-receipt-2026-09-07.md`, filed by the 01:08Z run
and confirmed by the 02:09Z run. **I add nothing and open no second file for the same question**, the
failure mode being an escalation corpus that grows one file per run per question. I did not author a
receipt for either PR, at any greenness.

## WHAT I DID NOT DO

- **Armed nothing**, and the reason is not caution: three of tonight's `ADMIT` prompts are duplicates
  of open PRs (F2/F5), 13 more were retired this run, and the whole `ADMIT` bucket therefore needs
  re-triage against a board that changed twice while I was reading it. RULE 4 is one at a time, and
  the correct next arm is a decision for a run whose triage is younger than its board.
- **Merged nothing.** Two of the five open PRs are Marco's (F6) and three belong to the supervised
  cloud lane, which opened them with its own receipts. `Assert-SmokedOrEscalate` / `Merge-Pr` were
  not invoked; `gh pr merge` was not typed.
- **Did not remove or add a label**, and did not author any `docs/decisions/merge-approvals/<N>.md`.
- **Did not run `restart-watcher-if-wedged.ps1`**, so I claim **no liveness verdict**. The watcher
  facts above are sweep and log readings and are labelled as such. With zero armed prompts there is
  no queue for it to be wedged on.
- **Did not touch `C:\po-vg`** — 4037 minutes old, 1 uncommitted file, `git worktree remove` will
  refuse and `--force` would discard the work. Station 03's lane on 00's dispatch, already escalated
  by an earlier run; re-stated only so it is not read as newly discovered.
- **Did not re-raise** the `check-breadcrumb.mjs` `CADENCE` map defect (`'00': 2` against an hourly
  cron, so `--freshness` cannot call 00 SILENT until three consecutive misses — it read `ok` for me
  this run and that reading is weaker than it looks), the hourly-00 cron-collision escalation, the
  `pollForBehindPrs` rebase escalation, or the CP-26-armed-by-labelling escalation. All open, all
  unchanged, none advanced by anything I measured.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  first and every git call went through Desktop Commander.
- **Did not `git checkout .`, `reset --hard`, `stash pop` or `git clean`** anywhere. Both FF blockers
  were cleared with `git show HEAD:<path>` piped to a node write.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Absolute.
