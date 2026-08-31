---
premise: '! grep -q "worktree-liveness" scripts/pipeline/status-sweep.ps1'
premise_means: >-
  status-sweep.ps1 still labels EVERY entry from `git worktree list` as an orphan, with the text
  "aborted run leftovers -- investigate/prune", and runs no liveness test at all. On 2026-08-31 at
  14:22Z it printed that line for C:/po-worktrees/sot-05-20260831 while Station 05 was actively
  working in it, with five modified sot/ files and an uncommitted breadcrumb inside. In the same
  sweep, section 7 answered SAFE TO ACT.
scope:
  - scripts/pipeline/status-sweep.ps1
done_when: >-
  grep -q "worktree-liveness" scripts/pipeline/status-sweep.ps1 && grep -q "LIVE STATION WORKTREE"
  scripts/pipeline/status-sweep.ps1 && grep -q "trunk-conclusion" scripts/pipeline/status-sweep.ps1
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# The sweep calls a working station's worktree an "aborted run leftover" and invites you to prune it

## The defect, measured

`scripts/pipeline/status-sweep.ps1:116-121`:

```powershell
# orphaned worktrees -- a leftover worktree means an aborted station run
$wt = @(git worktree list 2>$null | Where-Object { $_ -notmatch "\[main\]$" -and $_ -notmatch [regex]::Escape($Repo) })
if ($wt.Count -gt 0) {
  Line "LIVE" ("orphaned worktrees: " + $wt.Count + " (aborted run leftovers -- investigate/prune):")
```

There is **no liveness test**. Every worktree that is not the dev tree is declared an aborted
leftover, and the reader is told to prune it.

**Measured 2026-08-31T14:22:36Z**, one sweep:

```
[LIVE] orphaned worktrees: 1 (aborted run leftovers -- investigate/prune):
[LIVE]    C:/po-worktrees/sot-05-20260831 6e105076 (detached HEAD)
...
[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity.
```

At that moment, `git -C C:\po-worktrees\sot-05-20260831 status --porcelain` returned:

```
 M docs/data-model/metadata-catalog.json
 M docs/pipeline/stations/05-sot-keeper.md
 M docs/qa/sot-refs-baseline.json
 M sot/04-data-model.md
 M sot/README.md
?? docs/pr-prompts/00-05-sot-keeper-2026-08-31-1411-sot04-remerged-and-trap2-outlived-its-cause.md
```

Station 05's directory mtime was **80 seconds old**. `git worktree remove --force` on that path — the
action the line recommends — destroys four uncommitted `sot/` edits and an unwritten breadcrumb, with
no error and no recovery. This is the same shape as the 2026-07-13 incident where a check that
flagged "not on main" as BROKEN nearly licensed `rescue-watcher-repo.ps1` against a live agent.

The second half is worse than the label: **section 7 answered `SAFE TO ACT: no board mutation in
progress` while a station was mid-mutation**, because §7 never consults `$wt`. Station 00's own
arming discipline is gated on that verdict.

## Do

1. **Classify each worktree instead of labelling them all.** For every entry, measure two things:
   - `git -C <path> status --porcelain` — non-empty means uncommitted work lives there;
   - the directory's `LastWriteTimeUtc` age.

   Emit one of:
   - `LIVE STATION WORKTREE` — dirty, **or** touched within the last 30 minutes. Print the dirty
     file count and the age. **Say explicitly: do NOT prune; a station is working here.**
   - `orphaned worktree (aborted run leftover -- investigate/prune)` — clean **and** older than 30
     minutes. This is the only case that keeps the current wording.

   Print the age and the dirty count in both cases, so a reader can disagree with the classification
   from the same line.

2. **Feed the LIVE count into section 7.** A sweep that finds one or more `LIVE STATION WORKTREE`
   must not answer `SAFE TO ACT`. Downgrade to `CAUTION` and name the path and the station, in the
   same wording §7 already uses for a recently-touched PR. `DO NOT ACT` is too strong — a live
   worktree off `origin/main` is correct isolation, not a fault — but a supervisor deciding whether
   to arm has to know another station is mid-run, which is exactly what LL-38 records.

3. **The literal `worktree-liveness`** must appear in the script (a comment naming this prompt is
   fine); it is what the premise and `done_when` grep for.

## Positive control the implementer must run

Before believing the new classifier, prove it can return **both** answers on this machine:

```powershell
git worktree add C:\po-worktrees\_probe-clean origin/main --detach   # clean, brand new
# -> must classify LIVE (age < 30 min), NOT orphaned
New-Item C:\po-worktrees\_probe-clean\zzz-probe.txt -Value x         # now dirty
# -> must still classify LIVE, and report dirty=1
git worktree remove --force C:\po-worktrees\_probe-clean
```

A classifier that has only ever printed one of its two verdicts is not a classifier. Tear the probe
worktree down before you finish; leaving it behind reproduces the very thing this prompt is about.

## Do NOT

- Do **not** prune, remove, or `git clean` any worktree from inside this script. It reports; Station
  03 acts. A sweep that mutates is a sweep nobody can run safely.
- Do **not** use the presence of a `node.exe` process as the liveness signal. DOCTRINE §9.5: never
  count or kill by image name, and 21 `node.exe` were running when this was measured, exactly one of
  which was the watcher. Dirtiness and mtime are properties of the worktree itself and need no
  process table.
- Do **not** widen the 30-minute window into the classifier's only signal. A worktree can be dirty
  and hours old — that is still LIVE, because pruning it still destroys work. Dirty wins over age.

## A SECOND defect in the same script — fix both, in this one PR

Added 2026-08-31T14:5xZ, folded in from Station 04's `00-04-scanner-2026-08-31-1410-…` breadcrumb
(its F3), because it lives in the same file and two prompts editing one script is a conflict waiting
to happen.

**`status-sweep.ps1:86-88` decides "TRUNK IS RED" by grepping the human-readable table, so it matches
the commit TITLE, not the run conclusion:**

```powershell
$mfail = @($mainci | Select-String -Pattern "failure","cancelled","timed_out" -SimpleMatch).Count
```

`gh run list --branch main --limit 3` is called **without `--json`**, and the table's TITLE column is
the commit subject. Any commit whose subject contains one of those three words is counted as a failed
run. 04's control — two synthetic rows, **both conclusion `success`**, one titled
`fix(ci): stop swallowing a test failure` — produced
`2 success / 1 not-success  <-- TRUNK IS RED`, which is false.

This is not hypothetical here: of the last 400 `origin/main` subjects, **one already contains a
needle** — `fix(watcher): stop the exit -1 crash loop … treat every non-zero exit as a failure
(#1162)`. It fires whenever such a commit sits in the top 3. A sweep reading `TRUNK IS RED` at
14:11:31Z on 2026-08-31 could not be accounted for by a re-run (`run_attempt` = 1 on all 12 most
recent main runs) or by a genuine red (last 20 main runs = 20 × `success`).

**Do:** read `gh run list --branch main --limit 3 --json conclusion,displayTitle` and count the
**`conclusion` field**, never the rendered table. Escaping the needles is not the fix — it leaves the
class intact. The literal `trunk-conclusion` must appear in the script (a comment is fine); it is
what `done_when` greps for.

**Positive control:** feed the counter a fixture containing a `success` run titled
`fix(ci): stop swallowing a test failure` and prove it reports **0 not-success**, then feed it a
genuine `failure` conclusion and prove it reports 1. A counter that has only ever returned one answer
has not been tested.

## STANDING AUTHORITY

You have **STANDING AUTHORITY to finish the work, commit, push** the branch and open the pull
request. Do not stop to ask. If a step in "Do" turns out to be wrong, fix it and say so in the PR
body — but do not exit 0 without a PR.
