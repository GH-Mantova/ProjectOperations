# Station 00 — Supervisor | 2026-09-10T02:09:11Z–2026-09-10T02:4xZ

## GROUND

```
UTC            2026-09-10T02:09:11Z   (first probe on the box; run start)
origin/main    ed7dc38f               (at run start; bc8289db after this run's merges)
dev tree       main @ 640dbdd3        C:\ProjectOperations2   (0 ahead, 2 behind at start; ff'd to ed7dc38f)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run is not read-only by the version rule.

All three binding documents were read **in full**, from the working copy, which is sound this run
because `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**
(PREFLIGHT step 2's sanctioned form; no piped hash taken). Read in the DEV TREE, never the clone.

Needles minted and spent this run — all three returned 0 on the corpus they were pointed at, and
none is reusable now that this file lands: `zzQq00N20260910T0210Zk` (processed logs),
`zzQq00N20260910T0208Zq` (a collect breadcrumb), `zzQq00N20260910T0208Zw` (`needs-marco/`).

## WHAT I MEASURED

**Reachability.** [MEASURED] Desktop Commander tool ids were resolved by a keyword `ToolSearch`
for `desktop-commander`, not assumed; they resolved under
`mcp__plugin_desktop-commander_desktop-commander__`. `start_process` shell `powershell.exe`
returned a live shell and `[DateTime]::UtcNow` answered `2026-09-10T02:09:11Z`. **This run was
SIGHTED.**

**The device-bridge git guard could NOT be installed — FIFTH consecutive report.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` →
`bash failed on resume, create, and re-resume … is under Plan9 share "c" which is not mounted`.
Two honest attempts against two different mount targets, same failure class. Per PREFLIGHT this is
a FINDING, not a STOP. It is **already escalated** by the 01:10Z run as
`needs-marco/linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`; this run only
increments the count and does not re-file it. With no VM there is no VM-side `git` call to make, so
the hazard the guard exists to remove is absent this run — `index.lock` was False in both trees at
02:12Z and again at 02:17:44Z.

**Sweep.** [MEASURED] `status-sweep.ps1` run twice, both captured to a **file** rather than read
from the stream (it returns early and hides its own §7 verdict). §0 instrument controls PASS both
times (`gh CAN reach GitHub`, `node runs`). `02:12:01Z` → **SAFE TO ACT**; re-run
`02:17:44Z` immediately before the first board mutation → **SAFE TO ACT**, `index.lock` False /
False, `git processes running: 0`, `no PR touched on GitHub in the last 2 min`, `armed: 0`.

**Board, live at 02:16:37Z.** [MEASURED] `gh pr list --state open` — **5 open, 0 DIRTY**, every one
CLEAN and green, `labels=[]` on all five, `autoMergeRequest` off on all five.

| PR | scope | lane, by probe | RULE 2 |
|---|---|---|---|
| `#1835` | 2 files, `docs/pr-prompts/` | NO LOG — hand-classified, 00's own collect | free |
| `#1834` | `docs/decisions/merge-approvals/1827.md` | NO LOG — hand-classified `docs/` | free |
| `#1832` | `scripts/pipeline/vm-git-guard.sh` | watcher, **`marco:true`** | **BINDS** |
| `#1824` | 3 files, `docs/pr-prompts/` | NO LOG — hand-classified `docs/` | free |
| `#1823` | `apps/api` EA-GATE permission | watcher, **`marco:true`** | **BINDS** |

**Q1 answer: ZERO PRs are DIRTY.** No PR on this board has frozen CI. **Q3 answer: armed prompts
= 0** — `Get-ChildItem docs\pr-prompts -Filter '*-ready.md'` returned nothing at 02:16Z and the
sweep agreed at 02:17:44Z; the names were read, not the count.

**The RULE 2 probe, controlled.** [MEASURED] against the **live** tree
`C:\ProjectOperations2\docs\pr-prompts\processed`, never the clone: **2104** logs, newest
`2026-09-10T01:32:49Z` — younger than every open PR's `createdAt`, which is the control that
separates the live directory from the 21-log decoy in the watcher clone. POSITIVE
`marco.:true` (regex, dot matches the quote) → **627**; NEGATIVE `zzQq00N20260910T0210Zk` → **0**.
Matched on `PR #<n>\b` in the log BODY over `pr-*.log` only, excluding `rev-*` per §9.5.
`#1823` → 2 hits, `#1832` → 2 hits, both carrying a real merge-result line. `#1824`, `#1834`,
`#1835` → **0**, i.e. `NO LOG`.

`NO LOG` was **not** read as "second lane" on its own. Corroborated with the instrument the
watchdog kill loop cannot erase: `docs/pr-prompts/.arming-log.txt`'s newest row is
`2026-09-10T00:07:52Z ARMED pr-vmgitguard-selftest-and-recursion`, and all three of those PRs were
created after it with no arm in between, so no watcher build could have started for any of them.
Recorded as `[NO LANE VERDICT — hand-classified]`; all three are inside `^(tests|docs)/` and
inside Station 00's recorded lane (`STATION-CAPABILITIES.md` §5, and DOCTRINE §10.1 step 3).

**Collect.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 0,
`CLEAN`**, `structure: 25 checked, 0 malformed`:

```
00  last 2026-09-10T01:10:00Z  1.1h ago  (cadence 2h)  ok
03  last 2026-09-09T23:01:00Z  3.2h ago  (cadence 24h) ok
04  last 2026-09-09T22:02:00Z  4.2h ago  (cadence 4h)  ok
05  last 2026-09-09T22:02:00Z  4.2h ago  (cadence 24h) ok
```

`00`'s row still reads `cadence 2h` in that script's own `CADENCE` map against a live hourly cron —
unchanged, already on file, not re-filed.

**Crossed against `lastRunAt` from the scheduled-tasks MCP, which is where the freshness table
alone cannot answer.** [MEASURED] `00` `lastRunAt 2026-09-10T02:08:50Z` (this run, aligned);
`03` `2026-09-09T23:01:42Z`, `05` `2026-09-09T22:01:58Z`, both aligned with their newest
breadcrumbs. **`04` reads `lastRunAt 2026-09-10T02:10:29Z` — 99 seconds after this run started —
against a newest breadcrumb of `2026-09-09T22:02Z`.** That is not the "ran and did not report"
row of the table: **04 is executing right now**, and F4 below is what that means for this run.

**No station breadcrumb has been written since `00`'s own 01:10Z run**, so the collect queue was
empty on arrival. The 01:10Z run had already established the same for the 09-09 batch by reading
both predecessor breadcrumbs from `origin/main` rather than inferring it.

## WHAT CHANGED

**Armed nothing. Removed no label. Cleared no `marco:true` verdict. Touched no `/sot/` file, no
watcher, no clone, no worktree but my own, and no production data.**

1. **Fast-forwarded the dev tree** `640dbdd3` → `ed7dc38f`, 2 behind → 0. Read back
   `## main...origin/main` with no ahead/behind clause. It took three blockers in sequence and
   every step is recorded in F5.
2. **MERGED `#1824`** — `Assert-SmokedOrEscalate -PR 1824` then `Merge-Pr -PR 1824`, both returned
   True; read back `state=MERGED`, `mergedAt 2026-09-10T02:20:31Z`, merge commit `2539737e`.
3. **MERGED `#1835`** — same primitives. The first attempt THREW
   `Merge-Pr: #1835 is 'OPEN', not MERGED` because `mergeStateStatus` read `UNKNOWN` while GitHub
   recomputed mergeability seconds after `#1824` landed; the primitive's read-back caught it and
   refused to report success, which is exactly its job. Re-driven via native auto-merge; read back
   `state=MERGED`, `mergedAt 2026-09-10T02:22:50Z`, merge commit `bc8289db`.
4. **Armed native squash auto-merge on `#1834`** and ran `gh pr update-branch 1834` (`✓ PR branch
   updated`, new head `a3cfff72`) because it had gone BEHIND. `autoMergeRequest` read back present,
   `mergeMethod SQUASH`, `enabledAt 2026-09-10T02:21:50Z`. It was still BLOCKED on re-running checks
   when this run ended — **auto-merge enabled is not a merge, and it is not reported as one.**
5. **Published a `watcher: do-not-arm` marker on two `-HOLD.md` prompts** in this PR — F1 and F2.
   Both edits are strict supersets (`29 0` and `32 0`), both byte deltas asserted against the
   inserted block, and both prompts re-linted `REJECT [HUMAN_GATE_PRESENT]`, exit 1.
6. **This board PR**, built in a disposable worktree off `origin/main`
   (`C:\po-worktrees\collect-20260910-0208`, branch `docs/collect-2026-09-10-0208`) — never the dev
   tree, never the clone. The shared dev-tree index was confirmed EMPTY
   (`git diff --cached --name-status`) before anything was touched. The breadcrumb is written
   inside the worktree per cure 1, so no loose untracked copy is left in the dev tree.

## FINDINGS

### F1 — A consumed prompt still lints ADMIT on `main`, and arming it opens a second PR for work `#1832` already carries

My predecessor's F5 named the exact trigger and handed it forward: *"It becomes urgent if either
lints `ADMIT` rather than `STALE`."* **It fired.** All three consumed `-HOLD.md` files were pulled
from `origin/main` with `git cat-file blob` through `cmd /c` (never PowerShell `>`, §9.3), hash-
verified against `git rev-parse origin/main:<path>` on all three, and linted:

| prompt, from `origin/main` | blob | `lint-prompt.mjs` | its PR |
|---|---|---|---|
| `pr-brandtheme-s5-density-tokens-and-control-HOLD.md` | `e43080d3` | **STALE, exit 3** | `#1827` MERGED |
| `pr-ea-gate-report-self-filter-HOLD.md` | `827244e5` | **ADMIT, exit 0** | `#1823` **OPEN** |
| `pr-vmgitguard-selftest-and-recursion-HOLD.md` | `ba7a92bb` | **ADMIT, exit 0** | `#1832` **OPEN** |

The `brandtheme` row is the system working: its PR merged, its premise died, the linter bins it.
**The other two are DOCTRINE §10.6 exactly — the premise dies on MERGE, not on OPEN** — so for as
long as `#1832` and `#1823` sit unmerged, `main` advertises both prompts as fresh armable work.
`#1832` was armed at `00:07:52Z`, built, and opened as a PR that is now green and Marco's; nothing
in the prompt records that, and its `-HOLD.md` carries no marker of any kind.

**ACTIONED** — `<!-- watcher: do-not-arm -->` published on
`pr-vmgitguard-selftest-and-recursion-HOLD.md` in this PR, with the measured reason, the PR number,
and its clearing condition stated in the file. RULE 1: this is the complete-and-additive option and
the only one that passes both halves — it deletes nothing, it cannot start or stop work by itself,
and it makes the hazard visible to `lint-prompt.mjs` and to every actor that reads `origin/main`,
including the supervised cloud lane, which by DOCTRINE §10.2's own last bullet sees only what is
committed. `git rm`-ing the prompt fails the future half: if `#1832` were ever closed unmerged the
work would be gone. Leaving prose fails both — see F2. **Falsifying probe:** re-lint the file; it
must return `REJECT [HUMAN_GATE_PRESENT]`, exit 1. Measured here: it does.

### F2 — The second ADMIT is a DELIBERATE redo, so the marker is right and `git rm` would have been wrong — and its existing prose gate was invisible

This is the finding I nearly got backwards. `pr-ea-gate-report-self-filter-HOLD.md` lints ADMIT for
the same mechanical reason as F1, but its body reads **"CONSUMED — and AMENDED 2026-09-09 after the
PR it produced was rejected"**: `#1823` was routed REJECT-AND-REDO and a prior 00 run rewrote the
section that caused the rejection so the prompt could be **re-armed on purpose**. Treating it as
F1's accident and binning it would have destroyed a corrected slice.

**But the prose does not gate anything.** [MEASURED] the file already named `#1823` in five places
and still linted **ADMIT, exit 0** — DOCTRINE §9.5's recorded rule that *a prose human gate matches
neither regex and is invisible to both the linter and any grep built on them*, observed live on a
prompt whose author plainly intended a gate.

**ACTIONED** — the same marker, with a **different** clearing condition written into the file:
arm it once `#1823` is **closed unmerged**, which is what its REJECT verdict implies; if `#1823`
merges instead the premise dies and the prompt lints STALE on its own. The redo path is preserved
and made explicit rather than removed.

⚠️ **`#1823`'s own fate is ALREADY an open escalation and is deliberately NOT re-raised here** —
`needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md` records that REJECT verdict and
the expired evidence table behind it. What that escalation does not cover, and what this marker
closes, is the duplicate-PR hazard. **`[CANNOT MEASURE]` the verdict artifact itself:** all three
homes were probed — the dev tree, the clone's `docs/pr-reviews/`, and
`C:\po-watcher\verdicts-archive\` — and `pr-1823-review.md` is absent from every one. The
REJECT-AND-REDO reading rests on the prompt body and on that escalation, not on a verdict file, and
is tagged accordingly.

### F3 — Two PRs merged, one auto-armed; the board's remaining two are both Marco's and neither is waiting on an agent

**ACTIONED.** `#1824` (`02:20:31Z`, `2539737e`) and `#1835` (`02:22:50Z`, `bc8289db`) merged
through `Assert-SmokedOrEscalate` → `Merge-Pr`, both read back `MERGED`. `#1835` also discharged
its own predecessor's F1 falsifying probe: `pr-ea-s2-dashboard-preset-HOLD.md` on `origin/main` is
now blob `c9b5113b`, 356 lines, `do-not-arm` marker hits **2** — it was `0aa3413b`, 304 lines,
**0** hits at run start. The safety hold that existed on one disk is now on `main`.

`#1834` is armed for native auto-merge and had its branch updated; it will land itself.

**`#1832` and `#1823` are green, CLEAN and BEHIND, and both are Marco's.** Both carry a live
watcher `marco:true` verdict, and `labels=[]` on both does **not** clear it — removing
`do-not-merge` is not a RULE 2 clearance. Neither is waiting on any agent action: there is nothing
to fix, nothing to rerun, and nothing this station may do but leave them.

The 01:10Z run's warning about `#1832` stands and is carried forward: its WebKit `page.goto` crash
was read as a transient and rerun once, successfully. **If it reds again on the same error that is
a second occurrence, the transient reading is dead, and it must be treated as a real defect rather
than rerun a third time.**

**DEFERRED** on both, with nothing to do: they are Marco's to merge and they are ready for him.

### F4 — Station 04 fired 99 seconds after this run started, which is the collision already on file, at its sixth-of-six occurrence

[MEASURED] from the scheduled-tasks MCP: `00-supervisor` `5 * * * *`, `lastRunAt
2026-09-10T02:08:50Z` (jitter 172 s); `04-scanner` `0 */4 * * *`, `lastRunAt 2026-09-10T02:10:29Z`
(jitter 571 s) — **99 seconds apart, at 12:10 LOCAL**, which is as far from midnight as this
schedule allows. That is the 2026-09-07T18:1xZ correction in `STATION-CAPABILITIES.md` §6
reproducing exactly as it predicts: an hourly `:05` lands inside ten minutes of every one of 04's
six daily occurrences **by construction**, and the midnight slot is not special.

**This changed how this run acted rather than only what it recorded.** BOARD DRIVING condition 3
is the load-bearing one, so it was resolved rather than assumed: 04 is **read-only** on the board
by the `STATION-CAPABILITIES.md` §5 matrix (mutate board ❌, create PR ❌, merge ❌), and
`status-sweep.ps1` §3 — re-run at `02:17:44Z`, after 04 had started — reported `index.lock` False /
False, zero `git` processes, and no PR touched in the last two minutes. **The single-actor
condition was satisfied for board mutation.** The residual shared resource is the dev tree's git
index, and that was handled the prescribed way: every mutation this run made was in a disposable
worktree, and the index was read EMPTY before anything was touched.

**DEFERRED — already escalated, not re-raised.**
`needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` plus the §6 correction hold the
ask, which is **two offsets, not one**: moving 05 de-collides only the three-station midnight case,
while the 00×04 overlap survives any change to 05 and recurs six times a day. Both crons live in
the scheduled-tasks layer, which is Marco's, not this repo's. This entry exists so the count keeps
accruing against the existing file rather than starting a new one.

### F5 — The post-merge fast-forward took three causes in sequence, and the third produced a comparison that was WRONG IN BOTH DIRECTIONS

The dev tree opened 2 behind. Three blockers, each with a different cure:

1. **`.arming-log.txt` modified against HEAD.** The right instrument said it was not local work:
   `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` returned **EMPTY**, so the
   working copy already equalled `origin/main` and the ` M` was only against the behind-HEAD
   (DOCTRINE §9.2). Restored path-scoped; no append-only content was at risk because there was none.
2. **Two untracked breadcrumbs at paths the fast-forward had to create** — the documented cure.
   `00-05-sot-keeper-…-2202-…md` hash-matched `origin/main` exactly (`d37e6c48` both sides), so it
   was deleted and the fast-forward replaced it.
3. 🔴 **`00-00-supervisor-2026-09-09-2345-…md` did NOT match** — disk `d207e4ed` against
   `origin/main` `51448904` — and answering *"which side is newer?"* is where this run's own
   instrument lied to it.

**The lie, and it is §9.3's boundary rule with a delete attached.** `Compare-Object` was run over
`$a = git show origin/main:<path>` and `$b = Get-Content <path>`. PowerShell decodes those two
sources **differently** — `git show`'s output came back with `—` mangled to `\ufffd?"` while
`Get-Content` rendered it correctly — so every line containing an em dash appeared as a *pair* of
unique rows, one on each side. The counts (`36` vs `59`) were therefore mostly encoding noise, the
first 30 rows were a one-sided view of it, and **the sample I read off it supported the exact
opposite of the truth.** Both forms exited 0 and nothing was empty, so §9.6 never fires.

**The sound instrument, run afterwards, settles it in one line.** The blob was dumped with
`git cat-file blob` through `cmd /c` (never PowerShell `>`, §9.3) and both files compared in node,
on the same side of the boundary, CRLF-normalised:

```
origin/main copy   181 lines   lines only here: 36
disk copy          158 lines   lines only here: 17
```

**`origin/main` holds the LATER, BETTER text.** Its 36 unique lines are the
`[MEASURED — upgraded 2026-09-09 2350Z]` mock-up-versus-shipped column diff, taken properly from
the rendered `<th>` labels. The disk copy's 17 unique lines are the **superseded**
`[INFERRED — NOT MEASURED]` paragraph that upgrade replaced, plus its `[CANNOT MEASURE]` caveat and
an F4 the merged version drops. **Deleting the untracked disk copy lost nothing**, and the earlier
reading of this same evidence — that the disk held an upgrade `main` lacked — was **wrong and is
retracted here rather than left standing.**

**ACTIONED.** The file was copied to `%TEMP%` (`git hash-object` verified `d207e4ed` on the copy)
before the delete, so the retraction above could be measured rather than assumed; the fast-forward
then succeeded and reads back `## main...origin/main` with no ahead/behind clause.
🔧 **The rule this earns, and it is narrower and more useful than "do not truncate":
`Compare-Object` across a `git show` / working-copy boundary is measuring the ENCODINGS, not the
content, and its `<=`/`=>` sides are then meaningless in both directions.** DOCTRINE §9.3 already
says compare content with `git diff --numstat`, `git rev-parse` vs `git hash-object`, or
`Buffer.compare` in node **on the same side of the boundary**; this is that bullet meeting a
`Compare-Object` instead of a length, with a delete downstream of the answer.
**Falsifying probe:** re-run both forms on any file containing a non-ASCII character — the
PowerShell comparison must report differences that the node comparison does not.
**DEFERRED as a doc edit** — the home is §9.3, inside the `instruments v2` canonical block, which
needs `lint-station.mjs --write-canonical` and a PR of its own. It does not belong in a collect PR.
### F6 — Archiving was skipped for a fourth consecutive run, because nothing links a breadcrumb to the disposition that would let it be archived

The station doc's collect contract says to `git mv` a breadcrumb into `archive/` **once every
finding in it carries a disposition**. [MEASURED] the queue root holds **25** breadcrumbs against
**418** archived, and **15** of the 25 are dated `2026-09-08` — a full day and a half old.

Establishing which are archivable turned out not to be cheap. The obvious probe — search the
collect breadcrumbs for each candidate's filename stem — returned **0 for all 15**, and its
positive control (`Station` → 36 hits in the same file) and negative control
(`zzQq00N20260910T0208Zq` → 0) both passed, so the query was working and the zero was real. The
collects **do** disposition them; they just cite them as `09-08T10:11Z — F1` and
`00-03-machine-minder-2026-09-08-2303 — F0`, never by full filename. So the link exists only in
prose, in a different shape in each run, and every collect must re-derive it by hand.

**DEFERRED, deliberately, and this is the disposition rather than an omission.** Archiving on an
unproven claim is how a live finding goes quiet, and the two-sided cost is real: the archive move
happens in the PR worktree while the dev tree keeps an untracked copy at the root path, which the
station doc records as having produced a duplicated tracked breadcrumb once already.
🔧 **What would make it actionable, and it is the complete-and-additive option:** have the collect
run write the disposition back as a one-line footer in the breadcrumb it dispositioned —
`collected-by: 00-00-supervisor-<date>-<time> — F<n> <DISPOSITION>` — so `archive/` eligibility
becomes a grep with a positive control instead of a reading exercise. That is additive, changes no
existing finding, and is checkable by `check-breadcrumb.mjs`. It is a `scripts/` change and so
outside this station's lane to merge, which is why it is named here rather than attempted.
**It becomes urgent when the root count passes ~60**, half the 159 that made the board unreadable
in August.

## WHAT I DID NOT DO

- **Did not merge `#1832` or `#1823`.** Both carry a live watcher `marco:true` verdict and RULE 2
  binds absolutely; `labels=[]` on both does not clear it, and a station may not clear it at all.
  Both are green and CLEAN and waiting for Marco, which is the correct end state, not a blockage.
- **Did not report `#1834` as merged.** Auto-merge is armed and its branch is updated, but it was
  still BLOCKED on re-running checks when this run ended. Enabled is not merged.
- **Armed nothing**, and did not run `triage-holds.ps1` for arming candidates. Real armed count was
  0 at every reading. Station 04's 09-09T22:02Z F1 — the arming linter giving two opposite verdicts
  on one unchanged prompt eight minutes apart, erring toward ARM — is still unreproduced and
  unrefuted, so arming on a single ADMIT remains acting on an instrument under suspicion. This run
  used the linter only to REFUSE, which that suspicion does not touch.
- **Did not remove either `do-not-arm` marker, or the one `#1835` published**, and did not rule on
  the reasons behind any of them. Publishing a hold and clearing it are different acts.
- **Did not `git rm` any of the three consumed `-HOLD.md` files.** Two have open PRs and the third
  (`brandtheme`) lints STALE, so the linter already refuses it and removing it buys nothing this
  run while costing the audit trail.
- **Did not archive any breadcrumb** — F6, with the trigger named.
- **Did not touch the watcher, the clone, `C:\po-vg`, or any worktree but my own**, and did not run
  `restart-watcher-if-wedged.ps1 -Fix`. The sweep read `watcher node: RUNNING pid 13352`, wrapper
  alive, heartbeat 40 min with an empty queue — idle, which is correct and not a restart condition.
- **Did not prune the eight orphaned worktrees** the sweep lists, including `C:\po-vg` at 8298 min
  holding one uncommitted file. Pruning is 03's lane and that one holds work.
- **Did not commit `docs/data-model/metadata-catalog.json` or `docs/pipeline/sweep-rotation.json`.**
  Neither was measured this run, and `sweep-rotation.json` belongs to a Station 04 run that is
  executing right now (F4).
- **Did not edit DOCTRINE §9** for F5, or any other canonical-block bullet, for the reason F5 gives.
- **Did not re-file the Linux-sandbox outage or the 00×04 cron collision.** Both already have
  `needs-marco/` files; a second file for either would split the evidence, not strengthen it.
