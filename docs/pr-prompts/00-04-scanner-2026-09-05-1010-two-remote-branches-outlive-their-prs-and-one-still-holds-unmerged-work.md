# Station 04 — Scanner | 2026-09-05T10:10:07Z–2026-09-05T10:20Z

Sweep this run: **repo-hygiene** (`node scripts/pipeline/next-sweep.mjs` → `SWEEP: repo-hygiene`,
rotation position 3 of 4; previous run 2026-09-05T06:09:57Z).

## GROUND

```
UTC            2026-09-05T10:10:07Z
origin/main    8e5fc07d  →  f6809797   (it MOVED mid-run; see WHAT I MEASURED)
dev tree       main @ 8e5fc07d → f6809797   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **agree**, so this run was not restricted to read-only on that ground —
it is read-only because Station 04 always is.

Sighted: `start_process` shell `powershell.exe` returned pid 31344 on the Windows host. Not blind.

All three binding documents read this run. `git diff --numstat origin/main --` against
`docs/pipeline/stations/04-scanner.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` was **EMPTY** at `8e5fc07d`, so the working copies I read
are the `origin/main` copies — the form the PREFLIGHT block prescribes, not a piped hash.
Tree read in: the **dev tree** `C:\ProjectOperations2`, never the watcher clone.

## WHAT I MEASURED

**Sweep verdict — `DO NOT ACT`.** `status-sweep.ps1` at 10:10:36Z, captured to a file because it
returns early and hides its own §7 verdict: `DO NOT ACT: a board mutation is in progress`. Section 3
in detail: in-progress prompts **0**, `git index.lock` interactive/clone **False / False**, `git
processes running: 2`, no PR touched in the last 2 min. The verdict fired on the git-process count
alone. **I mutated nothing, so it did not bind me — but no later reader may quote this run as a
safe-to-act window.** [MEASURED]

**`origin/main` moved inside an eight-minute run.** `git rev-parse --short origin/main` = `8e5fc07d`
at 10:10:07Z and `f6809797` at 10:17:32Z, and the dev tree fast-forwarded with it (HEAD tracked the
same pair). Every count I took against the first is one commit short against the second — the
watcher-clone gap below reads **39** against `8e5fc07d` and **40** against `f6809797`. Recorded
because it is DOCTRINE §7's `[LIVE]` rule firing inside one run, on the cheapest possible fact.
[MEASURED]

**The board trap is clean.** Tracked `*-ready.md` at depth 1 on `origin/main` = **0**.
POSITIVE CONTROL: the same `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` returns
**791** tracked paths, **91** of them at depth 1, **79** of those `-HOLD.md` — so the query is
answering, not silently globbing to zero (§9.2). NEGATIVE CONTROL `-- docs/zzzNoSuchDirZzz/` → **0**.
Armed on disk = **0** (sweep §4). [MEASURED]

**Worktrees.** The registry holds exactly two: `C:/ProjectOperations2` and the orphan
`C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]`, age 1577 min. `Get-ChildItem
C:\ProjectOperations2\.git\worktrees -Recurse -Filter *.lock` = **0 lock files**. `worktree-registry-escapees:
none found under known roots`. [MEASURED]

**The standing "`--force` would discard `C:\po-vg`'s file" warning is CONFIRMED, not discharged.**
`git -C C:\po-vg status --porcelain` = one line, `?? scripts/pipeline/check-pipeline-heartbeat.mjs`.
A file of that exact path **is** on `origin/main` (`git cat-file -e` exit 0; POSITIVE CONTROL
`status-sweep.ps1` exit 0), which is the reading that would tempt a run to prune — **but the contents
differ**: `git rev-parse origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` = `84ec92d4…`,
`git -C C:\po-vg hash-object scripts/pipeline/check-pipeline-heartbeat.mjs` = `9c4587fb…`. The
worktree holds a version nothing else has. Existence is not identity. [MEASURED]

**Watcher-clone stashes: 66, growth ZERO in four hours.** Span `2026-07-14T08:44:31+10:00` →
`2026-09-03T18:55:05+10:00`; nothing new in ~2 days. Station 04's 06:10Z breadcrumb measured **66**,
which is what makes this a delta rather than another naked count — and it is the first time this
number has been compared against its own predecessor. Dev-tree stashes = **0**. I dropped nothing:
that is 03's, on 00's dispatch (§9.2 — `drop`, never `pop`). [MEASURED]

**`git branch -r` = 13 against 5 real remote heads** — see F7. [MEASURED]

**Shared dev-tree index clean.** `git diff --cached --name-status` = empty, so nothing of another
chat's was staged under me (§9.2). [MEASURED]

**Re-verified after `main` moved, at `f6809797`.** Every load-bearing claim was re-run against the
new head, because a claim that outlives its SHA is how a stale block sends a reader to redo finished
work (§7.1): F2's two numstats unchanged (`904 814`, `235 122`); `fix1483` still on the remote and
still PR-less; tracked depth-1 `*-ready.md` still **0**; F5's HOLD still `lint-prompt.mjs` **exit 3**.

**§9.4's counting trap reproduced live, inside that verification pass.** Re-checking F1 I wrote
`@(ConvertFrom-Json $raw).Count` inline and got **1** — which, taken at face value, would have
refuted the finding by inventing a PR for `fix1483`. `$raw` is literally `[]`. Assign-then-count
gives **0**; the controls are `@(ConvertFrom-Json '[]').Count` → **1** inline against **0** assigned,
and a branch with a genuine single PR → **1** both ways. **The trap is exactly as DOCTRINE §9.4
records it, it survives into a station's own re-verification step, and only the control separated the
two answers.** The original F1 measurement used the assign-then-count form and stands. [MEASURED]

**HOLD triage.** `triage-holds.ps1` (read-only) → `TOTALS spent=1 gates-satisfied=36 still-gated=42
unreadable=0 of 79`, with its own SPENT control passing (`lint-prompt.mjs` emitted exit 3 on the
fixture, so the SPENT bucket is measurable) and three distinct verdicts observed on the board.
[MEASURED]

## WHAT CHANGED

**Nothing on the board.** No branch deleted, no stash dropped, no worktree pruned, no HOLD retired,
nothing armed, no prompt staged, no PR opened or merged, no label touched.

Files written, all of which Station 00 must sweep because **04 may not commit**:

- this breadcrumb, `docs/pr-prompts/00-04-scanner-2026-09-05-1010-two-remote-branches-outlive-their-prs-and-one-still-holds-unmerged-work.md` — **untracked in the dev tree**;
- `docs/pipeline/sweep-rotation.json`, advanced with `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-05T10:10:07Z` — **left dirty in the dev tree, and 00 commits it**. If it is not committed the rotation silently stops and the next run repeats repo-hygiene.

Scratch outside both repos, safe to ignore: `C:\po-sup-fix-scripts\sweep-04-1015.txt`,
`C:\po-sup-fix-scripts\holds-04-1030.txt`, `C:\po-sup-fix-scripts\idx-main.mjs`.

## FINDINGS

### F1 — `fix1483` is a merged-but-not-deleted remote branch, and delete-on-merge structurally cannot see it. **S3.**

`git ls-remote --heads origin` (the authoritative form, §9.2) returns **5** heads. One of them is
`refs/heads/fix1483` at `9de07267`. `gh pr list --head fix1483 --state all` returns **0 PRs**
(NEGATIVE CONTROL `--head zzzNoSuchBranchZzz` → 0; POSITIVE CONTROL: the same query on
`docs/00-collect-0908-…` returns the open `#1652`). A remote branch that has never had a PR.

It is not orphaned work. `git log --oneline origin/main..9de07267` = **28** commits, of which **24**
are `Merge branch 'main' into feat/scope-s2-wbs-table-shell` and the other four are the real slice.
`gh pr view 1483` reports head `feat/scope-s2-wbs-table-shell`, state **MERGED**, mergedAt
`2026-09-02T02:46:46Z` — and that branch is **absent** from `ls-remote`, i.e. GitHub deleted it on
merge. Its four non-merge files are all on `origin/main` (`git cat-file -e` × 4 → true; NEGATIVE
CONTROL `origin/main:zzz/no/such/file.ts` → false), and three of the four are byte-identical to main
(`git diff --numstat origin/main 9de07267 -- <3 paths>` = empty); only `ScopeQuantitiesTable.tsx`
differs, because main has since moved through `#1646` and `#1651`.

**The mechanism is the finding.** Delete-on-merge deletes the PR's *head ref*. Any **second** ref
pointing at the same commits survives forever, and no "close the PR, delete the branch" sweep can
reach it, because nothing links `fix1483` to PR #1483 except a substring in its name. This is the
first measured instance on this board, and the naming convention (`fix<N>`) makes it likely to recur.

**DISPOSITION: ESCALATED.** Deleting a remote branch is on the DOCTRINE §5.4 irreversible list, so it
is not mine and not 00's to do quietly. RULE 1, complete-and-additive first:

- **(a) COMPLETE + ADDITIVE — add a queue check that lists remote heads with no open PR and reports them, and delete `fix1483` by hand once.** Passes both halves: it fixes today's litter *and* every future `fix<N>` twin, and it destroys no data entry — the check only reports, and the one deletion is of commits proven present on `main`.
- **(b) delete `fix1483` and nothing else.** Fails the *future* half: the next `fix<N>` twin repeats it, and nobody is looking.
- **(c) leave it.** Fails neither test on data, but fails the *immediate* half: the remote accretes dead refs that every later branch audit has to re-classify by hand.

### F2 — `feat/crm-account360-v2-s1` still holds work that PR #1612 closed WITHOUT merging, and nothing on the board records it. **S2.**

`gh pr view 1612`: title `feat(crm): CRM_ACCOUNT360_V2 - KPI tiles, next-action rail, two-column
layout, enriched header`, state **CLOSED**, `mergedAt` **empty**, `closedAt` `2026-09-04T22:56:48Z`.
The branch is alive on the remote at `4638600a`.

Its own changes, measured from the merge-base (not from main, which has moved 40 commits):
`git diff --name-only $(git merge-base origin/main 4638600a) 4638600a` = **2** files —
`apps/web/src/pages/crm/AccountDetailPage.tsx` and
`apps/web/src/pages/crm/__tests__/crmui-account360-s1.test.ts`.

Both paths exist on `origin/main` — **and that is exactly the reading that would let a run write this
off.** They do not carry the branch's content: `git diff --numstat origin/main 4638600a --` on those
two paths returns `904 814` and `235 122`. Main and the branch are materially different code.
POSITIVE CONTROL for the numstat form: `git diff --numstat origin/main 1239c33a --
docs/pipeline/DOCTRINE.md` → `28 405`, a file main is known to have changed.

One more detail worth having: the branch tip is a `Merge branch 'main' into feat/crm-account360-v2-s1`
dated `2026-09-05 08:43:24 +1000` = **2026-09-04T22:43:24Z**, thirteen minutes *before* the PR was
closed — `PR_WATCHER_AUTO_UPDATE` was still rebasing the branch as its PR died. Nothing cleaned up
after it.

So a whole CRM slice was closed unmerged and its only copy is a remote branch that no PR, no prompt
log and no board artefact points at. Whether that closure was deliberate is a product question.

**DISPOSITION: ESCALATED.** RULE 1, complete-and-additive first:

- **(a) COMPLETE + ADDITIVE — decide the slice's fate, and add the F1(a) check so a closed-unmerged branch is *reported* rather than discovered.** Passes both halves: it recovers or consciously discards this work *and* stops the next one going quiet, and reporting damages nothing.
- **(b) re-open #1612 or re-cut the branch as a fresh PR, nothing else.** Fails the future half — the next closed-unmerged slice is invisible again.
- **(c) delete the branch.** Fails the data half outright: on the measurement above, the content is not on `main`, so this destroys the only copy. **Do not do this before (a) is answered.**

The question for Marco, not a status update: **was #1612 closed because the work was rejected, or
because it was superseded and someone expected it to land another way?** The two answers point at
opposite actions on the branch.

### F3 — the watcher clone is 40 commits behind `main` and dirty, and for the merge-policy code specifically that costs nothing today — provably. **S3.**

`git -C C:\po-watcher\ProjectOperations rev-parse --short HEAD` = `04992194`; that commit **is** an
ancestor of `origin/main` (`git merge-base --is-ancestor` exit 0), clone-only commits = **0**,
commits the clone lacks = **40**. `git status --porcelain` in the clone = 3 entries.

`index.mjs` is the file that matters, because DOCTRINE §10.1 documents the running watcher's
behaviour from `origin/main` while the *process* runs from the clone. **They are the same blob:**
`git rev-parse 04992194:scripts/pr-watcher/index.mjs` and `git rev-parse
origin/main:scripts/pr-watcher/index.mjs` both return `901ea012…`, and `git diff --numstat` between
them is empty. Reading the clone's on-disk copy directly: `NESTED_TEST_PATHS` present with all three
forms (`/^(tests|docs)\//`, `/(^|\/)__tests__\//`, `/\.(test|spec)\.[cm]?[jt]sx?$/`), POSITIVE
CONTROL `classifyPolicyFiles` = true, NEGATIVE CONTROL `zzzNoSuchNeedleZzz` = false. The running
process is pid **20000**, started `2026-09-04T09:37:14Z`; the file's mtime is `2026-09-04T08:30:28Z`,
so the live process did load this copy.

**So DOCTRINE §10.1's paragraph on `NESTED_TEST_PATHS` is true of the code that is actually running,
not only of `main`.** That is worth stating, because §10.1 names the array as its own falsifying
probe and every previous run has answered it against `origin/main` only.

The 40-commit gap is still real and still wants closing before any restart changes behaviour (§9.5,
"a restart adopts nothing"). The three dirty files are ` M docs/data-model/metadata-catalog.json`,
`?? "C\357\200\272temppr-1648.diff"` and `?? scripts/pr-watcher/.conflict-notified-prs.json` —
**the latter two are already on Station 00's 09:08Z report; folded here, not re-filed.**

**DISPOSITION: DISPATCHED → 03 (machine-minder).** Fast-forward the clone to `origin/main` and clear
the two junk untracked files. Not mine: 04 is read-only and the clone is a shared tree (§4).

### F4 — a phantom "the clone is running different code" reading, and the two silent instrument lies that manufacture it. **S3, instrument.**

I nearly filed F3 as a defect. The route there is short, plausible, and exits 0 at every step:
read `git show origin/main:scripts/pr-watcher/index.mjs` into a JS **string** and take `.length`
(**131,135**); read the clone's working copy into a JS **string** and take `.length` (**134,461**);
conclude the clone carries **3,326 bytes** of code `main` does not.

Both numbers are wrong, for two unrelated reasons that stack:

1. **The blob is stored LF; the Windows working copy is CRLF** — one extra byte per line. [MEASURED]
   `delta = 3326` and `LF count in the blob = 3326`, **exactly equal**. The whole apparent difference
   is the line count wearing a byte count's clothes.
2. **`String.length` counts UTF-16 code units, not bytes.** [MEASURED] the same blob is **131,699
   bytes** and the same disk file **135,025 bytes** — each 564 larger than its string length, this
   file's non-ASCII content.

And the blob hashes are **identical** (`901ea012…` both sides), which is the answer the whole
comparison was reaching for.

DOCTRINE §9.3 already forbids PowerShell `>` for a member of this family and prescribes "read it with
node" as the cure — and **that cure is what produces lie (2)** if you then compare lengths instead of
hashes. §9.5's PREFLIGHT block already names the three sound forms (`git rev-parse <ref>:<path>`,
`git hash-object <path>`, `git diff --numstat`) but scopes them to reading one's own binding
documents; nothing generalises them to "any file, any tree". The gap is one bullet wide.

🔧 **The rule: never compare file *lengths* across a `git show` / working-copy boundary. Compare
hashes or `--numstat`.** A length difference between an object-store read and a Windows working copy
is the line count plus the non-ASCII count, and it is never evidence about content.

**DISPOSITION: DISPATCHED → 00**, for a one-bullet addition to DOCTRINE §9.3. 04 may not edit
DOCTRINE, and §9.3 sits inside the hash-gated `instruments v2` canonical block, so it needs a
re-record — which is 00's, not mine.

### F5 — `pr-cardui-s5-actions-and-expandables-HOLD.md` is now SPENT and must be retired, not armed. **S4.**

`triage-holds.ps1` → `spent=1 … of 79`, SPENT control PASS. The single SPENT prompt is
`pr-cardui-s5-actions-and-expandables-HOLD.md`. Its work shipped in **#1646** `feat(tendering): the
WBS table gets an actions column and three expandables (SCOPE_WBS_ACTIONS_V1)`, merged
`2026-09-05 08:50Z`.

This prompt was on a standing do-not-arm list **while #1646 was open** — same head branch, so arming
it would have opened a second PR for work already in flight. That condition has now resolved in the
*opposite* direction from "safe to arm": the premise is dead and `lint-prompt.mjs` says exit 3.
**Retire it; do not arm it.**

**DISPOSITION: DISPATCHED → 00** — move to `docs/pr-prompts/superseded/` in a board PR. Not mine:
04 does not disarm, rename, move or delete any prompt.

### F6 — three files loiter untracked *and un-ignored* in the queue root; one has never been committed in the repo's history. **S4.**

`docs/pr-prompts/` depth-1 on disk = **95**; tracked on `origin/main` = **91**. The four untracked are
one live Station 00 breadcrumb (expected — `#1652` carries it) plus:

| file | bytes | mtime (UTC) | commits in ALL history |
|---|---|---|---|
| `.queue-sync-ledger.txt` | 889 | 2026-08-19T23:19:32Z | 1 |
| `queue-watch-state.md` | 38,757 | 2026-08-31T20:26:21Z | 1 |
| `pr-watcher-merge-policy-nested-test-paths-LOOPING.md` | 5,283 | 2026-08-28T09:03:07Z | **0** |

POSITIVE CONTROL for the history column: `git log --oneline --all -- docs/pr-prompts/PROMPT-SCHEMA.md`
= **25**.

**None of the three is gitignored.** `git check-ignore -v` on each — the **file** form, never the
directory form, which prints nothing and exits 1 whatever the truth (§9.2) — returns exit 1 and empty
for all three. POSITIVE CONTROL `docs/qa/qa-findings.md` → `.gitignore:116`. NEGATIVE CONTROL
`CLAUDE.md`, tracked and genuinely not ignored → exit 1, empty. The controls are what separate
"visible-untracked" from "ignored", and they read identically without them.

Consequence: any board PR that stages the directory wholesale sweeps 44.9 KB of runtime state and a
dead prompt onto `main`. `-LOOPING.md` matches no watcher glob, so this is **litter, not a board
trap** — nothing here can arm. Separately, `status-sweep.ps1` §4C quotes `queue-watch-state.md` as
the "freshest station summary" on every run; it is 4.5 days old, correctly tagged `[FILE]`, and
nothing updates it.

Station 00 retired the *other* `-LOOPING.md` (`pr-doctrine-s9-four-false-traps-LOOPING.md`, in
`superseded/`) as F7 at 07:08Z. This is the second one, at **depth 1**, and 04's own 06:10Z
breadcrumb named it in passing without a disposition. It gets one now.

**DISPOSITION: DISPATCHED → 00.** Retire `-LOOPING.md` to `superseded/`; decide whether
`.queue-sync-ledger.txt` and `queue-watch-state.md` should be tracked or added to `.gitignore` —
today they are neither, which is the worst of the three states.

### F7 — the local remote-tracking cache has grown to 13 refs against 5 real remote heads. **S4.**

`git ls-remote --heads origin` = **5** (`main`, `docs/00-collect-0908-review-verdict-never-retired`,
`feat/crm-account360-v2-s1`, `fix/classify-policy-nested-tests`, `fix1483`). `git branch -r` = **13**:
those five, `origin/HEAD`, and **seven** hand-made refs — `pr/1477`, `pr/1478`, `pr/1483`, `pr/1487`,
`pr/1544`, `pr/1571`, `pr1273`.

DOCTRINE §9.2 measured **five** such extras on 2026-09-03 and states `--prune` can never remove them,
because `remote.origin.fetch` owns no refspec covering `refs/remotes/pr/*`. It is **seven** now, two
days later — the leak is live and accreting at roughly one per day. I ran `git fetch origin --prune`
twice this run; the count did not move. **The bullet is confirmed exactly as written; nothing in it
needs changing.**

**DISPOSITION: DEFERRED.** Harmless while every reader asks the remote. It becomes urgent the moment
a script counts branches from `git branch -r` — which is precisely the mistake §9.2 records
(54 reported against 21 real), so the next occurrence will look like a finding rather than an
instrument fault.

## WHAT I DID NOT DO

- **Mutated nothing on the board.** No branch deleted, no stash dropped, no worktree pruned, no HOLD
  retired or moved, nothing armed, no prompt staged, no PR opened or merged, no label touched. The
  authority matrix gives 04 *Create a PR: NO* and *Mutate the board: NO, read-only*, and the sweep's
  verdict was `DO NOT ACT` in any case.
- **Did not prune `C:\po-vg`** despite it being tagged an orphan every run — it holds a version of
  `check-pipeline-heartbeat.mjs` that exists nowhere else (F-list, WHAT I MEASURED), and
  `--force` would destroy it. That is 03's, on 00's dispatch.
- **Did not drop any of the 66 watcher-clone stashes**, and never `pop` (§9.2). Did not fast-forward
  the clone or clear its junk files: shared tree, 03's lane.
- **Did not delete `C:temppr-1648.diff` or `.conflict-notified-prs.json`** — already reported by
  Station 00 at 09:08Z; re-filing them would inflate the finding count without adding information.
- **Ran no `git checkout .`, `reset --hard`, `stash pop` or `git clean`** anywhere — the board trap.
- **Ran `git` only through Desktop Commander**, never through any other transport against the Windows
  `.git` (§9.2, the 0-byte `index.lock`).
- **Minted no throwaway worktree.** Every `origin/main` read was `git show` / `git rev-parse` /
  `git cat-file` at a named ref, in the dev tree.
- **No Part 0 static audit and no live-site pass this run.** `next-sweep.mjs` named `repo-hygiene`,
  and the station doc's instruction is to take ONE named sweep and cover it completely rather than
  pass shallowly over everything.
- **Did not touch `/sot/`** (05's), Azure / Entra / SharePoint (absolute), or production data.
- **Did not write to `docs/qa/qa-findings.md`.** It is gitignored at `.gitignore:116`; a finding that
  lives only there is unreported.
