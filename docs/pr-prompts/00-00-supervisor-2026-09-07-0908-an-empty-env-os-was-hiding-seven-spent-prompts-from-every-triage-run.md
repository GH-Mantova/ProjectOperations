# Station 00 — Supervisor | 2026-09-07T09:08Z–09:45Z

## GROUND

```
UTC            2026-09-07T09:08Z
origin/main    41a98177 at first fetch -> b46d7cb8 (08:53Z) -> 200231c2 (09:13Z, mid-run)
dev tree       main @ 200231c2   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Version and bootstrap AGREE. Sighted run: `start_process` shell `powershell.exe` returned
`LAPTOP-E6NHU4E4` at 09:08:46Z.

VM git guard installed, last line quoted: `persistence controls passed: .bashrc byte-identical on
re-run; login shell resolves shim`.

All three binding documents read IN FULL from the dev tree, after proving the dev tree copy is
identical to `origin/main`: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**. `00-supervisor.md`
was then CHANGED under me by `#1773` merging at 09:13:46Z; the new `## NO-DRIFT` section was read
from `git diff b46d7cb8 200231c2` and is obeyed below.

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` 09:10:56Z, captured to a file (it returns early and hides its own §7
  verdict otherwise). Verdict: **CAUTION** — no local lock, but a PR was touched on GitHub inside
  two minutes; act only on NEW branches/PRs, in an isolated worktree. That is exactly what this run
  did.
- [MEASURED] Watcher: node RUNNING pid **31660**, auto-restart wrapper alive (1), heartbeat **2 min**.
  Not wedged, not down. Watcher clone `branch=main dirty=6`.
- [MEASURED] Queue: armed = **1**, and it is `rev-1775-ready.md` — an auto-generated REVIEW JOB, not
  a prompt (DOCTRINE §9.5). **Real armed count = 0.**
- [MEASURED] `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0. 00 1.1h · 03 10.2h · 04 3.1h ·
  05 19.1h, all `ok`. Cross-checked against the root breadcrumb set: only two `00-*.md` at depth 1,
  both mine (0708, 0808), both already tracked. **No new station breadcrumb has been written since
  my 08:08Z run**, so this run's COLLECT has nothing from 03/04/05 to disposition.
- [MEASURED] Board at 09:1xZ: **5 open PRs, every one BEHIND, and every one Marco's.**

  | PR | lane evidence | classification |
  |---|---|---|
  | `#1775` | `do-not-merge` label; `apps/api/**`, `package.json`, `scripts/rates/**` | Marco's, label + hand-classified |
  | `#1774` | `do-not-merge` label; `.github/workflows/ci.yml`, `scripts/pipeline/check-hex-ratchet.mjs` | Marco's, label + hand-classified |
  | `#1769` | real watcher verdict `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` | **RULE 2 binds absolutely** |
  | `#1767` | `do-not-merge` label; carries `apps/api/prisma/migrations/**` | Marco's, absolute |
  | `#1760` | no log; `scripts/pr-watcher/index.mjs` | `[NO LANE VERDICT — hand-classified]` Marco's |

  RULE 2 probe pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`:
  **2049** logs, newest **2026-09-07T09:10:29Z** — younger than the oldest open PR (`#1760`,
  created 05:34Z), which is the control that separates the live directory from the dead clone copy.
  POSITIVE `marco.:true` → **620**. NEGATIVE, freshly minted needle `zzQq00Needle20260907T0920`
  → **0** (that needle is now spent; mint another).
- [MEASURED] `#1771` merged 08:53Z and `#1773` merged 09:13Z, both by the **supervised cloud lane**
  under DOCTRINE §10.2.1, both leaving a `docs/decisions/merge-approvals/<N>.md` receipt in their own
  diff. `1771.md` reads `approved_by: marco`, `approved_at: 2026-09-07T08:25:58Z`, and cites the
  standing chat authority. This is the authorised lane, not an unknown actor — **do not re-raise it
  as an attack**, and do not revert.
- [MEASURED] `$env:OS` in a Desktop Commander station shell is **empty** (`env:OS=[]`), while
  `ComSpec` is `C:\Windows\system32\cmd.exe`. See F1.
- [MEASURED] `gh run list --commit <full 40-char SHA>` — the short form returns `[]` at exit 0
  (§9.4) and did so here for `200231c2` before I corrected it.

## WHAT CHANGED

1. **`#1776` opened and armed for auto-merge** — `docs(pr-prompts): retire seven SPENT holds whose
   work has already shipped`. Seven `R100` renames into `docs/pr-prompts/superseded/`, nothing else
   staged. Read back: `files=7`, `bodyLen=2712`, body table intact (the `--body-file` form, because
   `--body` with backticks fails silently), `autoMerge=True`, `state=OPEN`. Built in a disposable
   worktree off `origin/main`, which was then removed — `git worktree list` now shows only the dev
   tree and `C:/po-vg`.
2. **Re-ran the failed `Tendering Browser Smoke` on `b46d7cb8`** (`gh run rerun 34103020415 --failed`).
   See F4.
3. **Dev tree fast-forwarded twice**, `41a98177 → b46d7cb8 → 200231c2`. Read back
   `git rev-list --left-right --count HEAD...origin/main` → `0 0`. The one non-empty line in
   `git diff --numstat` is the ` D` of `pr-triageholds-s2-env-os-is-empty-in-a-station-shell-HOLD.md`,
   the prompt `#1769` was built from and will delete on merge — left alone deliberately, because
   restoring it is how a consumed prompt comes back armed (§9.2).
4. Nothing else. **No prompt was armed. No PR was merged.**

## FINDINGS

**F1. `triage-holds.ps1` was blind for three runs because a station shell has no `$env:OS`, and one
line in the shell fixes it today.** The script picks its premise shell from `$env:OS`; empty means
`/bin/bash`, which does not exist on this host, so 30 of 53 holds read `PREMISE UNMEASURABLE` and its
own control failed and said so. [MEASURED] this run: with `$env:OS = 'Windows_NT'` set in the station
shell first, the same script printed `GIT control: PASS` and `SPENT control: PASS`, **zero**
`UNMEASURABLE`, and a full 53-hold triage — the first complete one since the defect appeared.
**DISPOSITION: ACTIONED.** The workaround is session-level and must be re-applied by every station
that shells out to `triage-holds.ps1`; the permanent fix is `#1769`, which carries a real
`marco:true` verdict and is not mine to merge.

**F2. Seven prompts were SPENT — their work is already on `main` — and they were still sitting in the
bucket an arming decision reads from.** `lint-prompt.mjs` exits 3 on each: `armguard-s2`,
`module-provenance-s2` (`#1763`), `pipeline-nodrift-agents-write-sweep-commits` (`#1773`, twelve
minutes old), `rates-plant-fuel-column` (`#1746`), `statussweep-local-time-timestamps` and
`sweep-dead-queue-dir-reads` (both `#1771`), `watcher-app-auth-switch-on` (`#1510`).
⚠️ Retiring `watcher-app-auth-switch-on` does **not** discharge its open half:
`PO_WATCHER_APP_ID` / `PO_WATCHER_INSTALLATION_ID` are still never set, so the watcher still
authenticates as `GH-Mantova`. That half is Marco's and stays escalated.
**DISPOSITION: ACTIONED** — `#1776`, auto-merge armed.

**F3. Eighteen prompts read ADMIT and NOT ONE of them is tests/docs-only, so every arm would add a
sixth Marco-gated PR to a board where I can already merge nothing.** [MEASURED] each prompt's
`scope:` against `classifyPolicyFiles`' three accepted forms: every one carries at least one path
outside `^(tests|docs)/`, `(^|/)__tests__/` and `\.(test|spec)\.[cm]?[jt]sx?$` — `.github/workflows/**`,
`scripts/**`, `apps/**`, `sot/**` or `migrations/**`. Three are outright §10.6 duplicates of PRs that
are already open, matched on `scope:` and confirmed on the work, not on the branch name:

| prompt | open PR | overlap |
|---|---|---|
| `pr-brandtheme-s2-hex-ratchet-HOLD.md` | `#1774` | 4 of 4 files, exact |
| `pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md` | `#1775` | 4 of 4 files, exact |
| `pr-watcher-gate-path-space-HOLD.md` | `#1760` | 2 of 2 non-receipt files, exact |

Also standing: `pr-tr-s1-reminder-policy` (migration, and `#1767` already builds it),
`pr-triage-holds-open-pr-duplicate-bucket` (same single file as `#1769`, so it would collide),
and the two `pr-sot-*` (Station 05's lane).
**I armed nothing, deliberately, for the second run running.** The board is throughput-limited by
Marco, not by the queue: arming faster makes the queue longer, not shorter.
**DISPOSITION: DEFERRED.** The trigger is precise and must be re-tested every run — **the moment one
ADMIT prompt's `scope:` is confined to those three forms, ARM IT**, because that one merges itself
with no human.

**F4. The trunk went RED on `b46d7cb8` on a diff that cannot have caused it.** `Tendering Browser
Smoke` failed with exactly one test: `batch7-field.spec.ts:264 › timesheet submits for today;
duplicate attempt shows the friendly 409 message`, on
`expect(page.getByText(/Timesheet submitted — 8 hours/)).toBeVisible()` timing out at 10 s. The very
next test, `:307`, which drives the same duplicate-409 path, PASSED. `#1771`'s diff is
`scripts/pipeline/status-sweep.ps1` plus a receipt `.md`; the eleven preceding main commits were all
`success` on this workflow. A code check failing on an unrelated diff while `main` was green is the
station doc's definition of a transient, so I re-ran it rather than diagnosing a defect.
**DISPOSITION: ACTIONED — resolved before this report closed. THE TRUNK IS GREEN.** [MEASURED]
09:29Z, `gh run list --commit 200231c259d0f9a8e34f833b6321f463b67fe697` (the FULL 40-char SHA — the
short form returns `[]` at exit 0, §9.4): `CodeQL success · CI success · Deploy success ·
Tendering Browser Smoke success`. The same suite, the same spec, one commit later, no code change to
it — so `b46d7cb8`'s red was transient, exactly as the unrelated-diff rule predicts.

🔴 **And the prescribed cure did NOT answer it — record this, because the next run will reach for it
too.** `gh run rerun 34103020415 --failed` on `b46d7cb8` came back **`cancelled`**, not `success` and
not `failure`: `main` had already moved to `200231c2`, and the workflow's concurrency group cancels a
run on a superseded commit. **A re-run on a commit that is no longer `HEAD` returns a third value
that is neither pass nor fail**, at exit 0, and a run that treats `cancelled` as "still failing" or
as "now green" is wrong in both directions. **Once the trunk has moved, the question "was that red
real?" is answered by the NEXT commit's run, never by re-running the old one.**

**F5. `#1773` put a `## NO-DRIFT` section in my station doc that contradicts the canonical block in
the same document, one screen above it.** The `station-contract v3` canonical block's REPORT CONTRACT
says a breadcrumb's best home is *"inside your own run's PR"*; `## NO-DRIFT`, landed 09:13Z, says
*"Breadcrumbs, station notes and scanner output are left UNTRACKED. You do not commit them at all."*
Both are binding text in `docs/pipeline/stations/00-supervisor.md` at `200231c2`. I obeyed the newer,
more specific rule this run — this breadcrumb is untracked and goes up through
`scripts/pipeline/sweep-breadcrumbs.ps1`, whose `-WhatIf` I ran first. The conflict is real and will
be re-derived by every station that reads the file.
**DISPOSITION: DEFERRED**, for the reason the document itself already records: the fix belongs in the
canonical block, and a canonical-block change must be re-recorded and shipped across all seven
station docs in ONE PR, which is more than a collect run should carry. **The trigger is any run that
is already shipping a cross-doc change** — fold it in there.

**F6. `C:\po-vg` is now 73 hours old, holds one uncommitted file, and is still registered as a
worktree.** [MEASURED] by the sweep: `C:/po-vg 23c91ba9 [fix/no-rebase-while-checks-run] dirty=1
age=4397 min`, with the sweep's own warning that `git worktree remove` will refuse and `--force`
would discard the work. The watcher clone is also `dirty=6` on `main`.
**DISPOSITION: DISPATCHED → Station 03.** Both are machine hygiene inside 03's lane and neither is
mine to clean. This restates an already-open dispatch so it does not age out of the record; 03 runs
daily, so expect up to 24 h of latency.

**F7. `sweep-breadcrumbs.ps1` — the mechanism `#1773` made mandatory for every station's breadcrumb
two hours ago — CANNOT LAND A BREADCRUMB ON THIS BOX, and it fails on the one trap DOCTRINE §7 names
by name.** [MEASURED] 09:30Z: `-WhatIf` correctly listed the single sweepable file; the real run then
printed `Creating branch chore/sweep-breadcrumbs-20260907-0930`, and died with
`NativeCommandError` on git's own stderr line *"Switched to a new branch"*. **Nothing was staged,
nothing committed, nothing pushed, no PR** — and the **dev tree was left OFF `main`, on the new
branch**, which is the drift the script exists to prevent.

The cause is one line: **`scripts/pipeline/sweep-breadcrumbs.ps1:72` sets
`$ErrorActionPreference = "Stop"`**, while `Invoke-Git` merges stderr with `& git @GitArgs 2>&1`.
DOCTRINE §7 standing guard 7 is this verbatim: *"`$ErrorActionPreference = "Continue"` in git
scripts. Git warns on stderr; `"Stop"` will abort you before your commit while the log still looks
perfectly clean."* Here it was at least loud rather than silent — but the outcome is a station that
believes it reported and did not, which is the failure the REPORT CONTRACT exists to stop.

⚠️ **The naive cure is wrong and would be worse.** `Invoke-Git` signals a genuine git failure with
`Write-Error`, which under `"Continue"` no longer terminates — so flipping the preference alone turns
a failed `git add` into a commit that proceeds anyway. The complete-and-additive fix is BOTH halves:
`"Continue"` at the top so native stderr cannot throw, **and** `throw` in place of `Write-Error` on a
non-zero exit so a real failure still aborts regardless of the preference.
**DISPOSITION: ACTIONED** — `#1777` opened with that two-part fix. It touches `scripts/`, so it is
outside `^(tests|docs)/` and **Marco's to merge**; I drove it, I do not merge it.

🔬 **This breadcrumb IS the positive control.** After `#1777` was pushed, the FIXED script was run
against the dev tree (`-RepoRoot C:\ProjectOperations2`) and landed this file through the
branch-and-PR path the broken version could not reach — the pass the failing version was never seen
to produce (§7 standing guard 1). If you are reading this on `main`, the fix works.

⚠️ **Until `#1777` merges, `## NO-DRIFT` is unfollowable for every other station**, because the tree
they run in still has the `"Stop"` version. Any station that reaches for the sweep before then gets a
loud crash and a dev tree left off `main` — and F5's conflict means the canonical block's fallback
("write it inside your own run's PR") is the one that still works.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs are Marco's — one by a real watcher verdict, three by a
  `do-not-merge` label, one by hand classification, and `#1767` twice over because it carries a
  migration. `#1776` is my own docs-only PR and is armed for native auto-merge, not hand-merged.
- **Armed nothing** (F3), and specifically did not arm the three §10.6 duplicates, the two
  `pr-sot-*` (05's lane), `pr-tr-s1-reminder-policy` (migration), or
  `pr-triage-holds-open-pr-duplicate-bucket` (would collide with `#1769` on one file).
- **Did not restore** the deleted tracked `pr-triageholds-s2-...-HOLD.md` in the dev tree. `#1769`
  deletes it on merge; restoring a consumed prompt is the board trap.
- **Did not touch** the watcher, its clone, `C:\po-vg`, `/sot/`, any label, or anything under Azure /
  Entra / SharePoint.
- **Did not fix `triage-holds.ps1` myself** — the fix is already open as `#1769` and is Marco's; I
  applied the shell-level workaround instead and said so.
