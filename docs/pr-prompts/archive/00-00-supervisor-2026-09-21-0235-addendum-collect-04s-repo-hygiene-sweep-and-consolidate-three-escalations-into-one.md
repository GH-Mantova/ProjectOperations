# Station 00 — Supervisor | 2026-09-21T02:35Z–2026-09-21T02:5xZ (ADDENDUM to the 02:08Z run)

**This is the same run, later.** My 02:08Z breadcrumb closed F-5 as *"04's 02:10Z breadcrumb does not
exist yet; DEFERRED to the next 00 occurrence."* **It exists now** — 04 finished at 02:35Z, eight
minutes before my slot ends. Deferring a collect to the next hour when the artefact landed inside
this one would be a scheduling accident dressed as a disposition, so this addendum collects it.

## GROUND

```
UTC            2026-09-21T02:35Z
origin/main    c3fb3add              (this run's own #2024, merged 02:32:48Z; fetched, then rev-parse)
dev tree       main @ c3fb3add       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Preflight was performed once for the whole run and is stamped in the 02:08Z breadcrumb: not blind
(PID 28156, still the only shell), git guard installed and its last line quoted, the three binding
documents read in full after `git diff --numstat origin/main` proved them identical to `origin/main`,
sweep run, section 7 `SAFE TO ACT`.

## WHAT I MEASURED

**04's breadcrumb arrived, untracked, and so did an advanced rotation file.** [MEASURED]
`git status --porcelain -- docs/pr-prompts` after the post-merge fast-forward:
`?? docs/pr-prompts/00-04-scanner-2026-09-21-0210-thirteen-of-fourteen-remote-heads-are-dead-and-three-escalations-own-the-question.md`,
and `git diff --numstat` → `2 2 docs/pipeline/sweep-rotation.json`, advanced `last_index 1 → 2`,
`last_run_utc 00:04:59Z → 02:10:59Z`. Both are exactly what 04's own WHAT CHANGED section names and
asks 00 to commit — **04 may not commit in the dev tree, and if nobody does, its report is
unreported and the sweep rotation stops turning.** Copied into this PR's worktree byte-exact with
node and read back with `Buffer.compare` → identical, 28924 B and 2837 B.

**04's run is sound and I am not re-deriving it.** Its GROUND stamps `doc version 1 / bootstrap 1`,
it proved its own binding documents against `origin/main` with the unpiped form, it installed the
git guard, and every zero it reports carries a positive and a negative control. Where it and I
measured the same thing we agree: armed **0**, HOLDs **27**, clone tracked-dirty **0** against
`status --short` **1**, no `[STALE]` rows, `SAFE TO ACT`.

**Its F3 asked me a question and I have the answer.** 04 recorded the trunk red as genuine
(`gh api .../attempts/1` → attempt 1 `failure`) with attempt 2 `in_progress` at 02:22:53Z, and wrote:
*"If attempt 2 also fails, the browser smoke on trunk is a real finding and belongs to 00; if it
passes, trunk is green and the failure was a retryable flake worth counting."* [MEASURED] at
02:28:02Z: `{"attempt":2,"conclusion":"success","status":"completed"}`, and
`gh run list --commit 8c6515740f2d9f2ca9db9532ca7b5caea68ed2ce` → **4 of 4 `success`**. **It passes.
Flake, counted.** Two stations reached the same reading from opposite directions in the same hour
without seeing each other's work, which is the closest this pipeline gets to a replication.

**The three escalations 04 named are one question, and I read all three before merging them.**
[MEASURED] `remote-branches-outlive-their-prs-2026-09-05.md` (7860 B),
`stale-remote-heads-and-auto-delete-2026-09-08.md` (3204 B),
`stale-remote-heads-need-auto-delete-on-merge-2026-09-10.md` (4705 B). All three ask for the same
repository setting; the census in them grows 5 heads → 8 → 14, and 04 measured **15** today. The
2026-09-05 file additionally carries a caution the other two repeat, and it is the reason a naive
merge of these files would be dangerous: `#1612` is *also* "a remote head with no open PR" and the
correct action on it is **preservation**, not deletion.

## WHAT CHANGED

1. **04's breadcrumb and the advanced `docs/pipeline/sweep-rotation.json` are committed** — in this
   PR, which is the only channel that makes either of them real.
2. **Three escalations consolidated into one**, and none deleted — see F-A.
3. **No merge of anything but this run's own board PRs. No arm. No label touched. No branch deleted.**

## FINDINGS

### F-A — 04's F2 discharged: three escalations on one subject are now one, and none was deleted

04 dispatched this to me in as many words: *"consolidate those three into one escalation and put a
single question to Marco. A fourth filing is the failure mode, not the remedy."*

**What I wrote.** `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` — today's
census split into the three classes that take different actions (3 MERGED, 10 CLOSED-UNMERGED, 1
never-opened, 1 live), the single question in one sentence, the RULE 1 option set with (a)
complete-and-additive first, and **two explicit exclusions**: `#1612` is not to be deleted and is not
folded in, and neither is `#2005` — both have their own escalations whose correct action is the
opposite one. It also carries forward the two instrument traps these files already measured, because
they are what stops the next reader getting it wrong: `git branch -r` answered **75** against a
remote truth of **15**, and `git merge-base --is-ancestor` answered NOT-in-main for **all 15** heads
including the three whose PRs merged, because every merge here is a squash.

**Nothing was deleted.** Each of the three now carries a four-line SUPERSEDED banner at the top
pointing at the consolidated file and saying it is kept as provenance. Prepended by **concatenation**
in node, never a `String.replace` replacement string (§9.3 — `$` is live in one), and each asserted:
`7860 → 8226`, `3204 → 3570`, `4705 → 5071`, **delta 366 = expected 366** on all three, with
`Buffer.compare(after.slice(366), before) === 0` proving the original bytes are untouched. The script
is idempotent — it re-reads the banner and skips a file that already has one.

**Why three existed, which is the part worth keeping.** Each was filed by a different run, correctly,
against a census it had just measured, and none could see that the question was already asked. That
is `needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md` producing its predicted
effect on a real subject — the fourth instance of that escalation, and the first where the cost is
visible as duplicate files in Marco's own queue rather than as a dropped hand-over.

⚠️ **The consolidation reaches Marco only if he opens the folder.** `needs-marco/` is gitignored, so
naming it here is the only tracked record that it happened.

**DISPOSITION: ACTIONED.**

### F-B — 04's F7: DOCTRINE §8.5 sends breadcrumbs to a directory that does not exist

04 measured `docs/pr-prompts/reports/` absent from disk (`Test-Path` → False) and **0** tracked paths,
while the `station-contract` canonical block in all seven station docs mandates depth 1, and
`check-breadcrumb.mjs`'s structure pass reads `readdirSync(DIR)` — depth 1 only. §8.5 says of itself
*"Not yet enforced … written in S1 and enforced in S4"*, so nothing is broken today; the drift is that
two binding documents give different homes for one artefact, and the unimplemented one would move
every breadcrumb out of the validator's structure pass.

**I am not choosing between 04's options this run, and the reason is the option set itself, not the
slot.** Its (a) — *move reports and widen the validator in the SAME PR* — is the complete-and-additive
one and it is a `scripts/` change, outside Station 00's merge lane, so the PR would open and sit. Its
(b) — *strike the `reports/` sentence from §8.5* — is a DOCTRINE edit squarely in my lane and takes
ten minutes, but 04 scores it as failing RULE 1's *future* half, and it would delete a standard
written to solve a real problem (31 loose report files) on the authority of a station that did not
write it. **Taking the cheap half of a RULE-1 option set because it is the half I am allowed to do is
how a complete fix becomes a partial one permanently.**

**DISPOSITION: DEFERRED**, with the trigger named: it becomes urgent **the moment anyone implements
S4**, because that is the first point at which the contradiction has an effect rather than being
latent. 🔧 The next run with slot should stage it as a `-HOLD.md` carrying option (a) whole — the
`reports/` move *and* the `check-breadcrumb.mjs` structure-pass widening in one diff — exactly as
this run staged CP-27 for the `sot/02` question. That is the shape that keeps both halves.

### F-C — 04's F1 second half and F5: two items for Station 03, carried forward unchanged

- **`C:\po-worktrees\po-fix-2005`** — 04 proved it dead rather than assuming it: no `.git`, in no
  worktree registry, **0 files and 0 bytes** recursively (POSITIVE control on the identical query
  form over `scripts\pipeline` → **91** files, so the zero is real), **6079** empty directories, 3.4
  days old. A plain `Remove-Item -Recurse`. 04 removed nothing because deleting directories on the
  box is 03's.
- **The watcher clone is 7 commits behind `main`** (`git rev-list --count 895bdefc..8c651574` → 7).
  The watcher runs `index.mjs` from the clone and a restart adopts nothing, so every
  `scripts/pr-watcher/**` fix in those 7 commits is on `main` and not in the running process. Owned
  by `needs-marco/nobody-may-fast-forward-the-watcher-clone-2026-09-07.md`.
- **`C:/PR-Master/worktrees/po-vg`** — unchanged and still must not be `--force`d: 04 measured its one
  untracked file `scripts/pipeline/check-pipeline-heartbeat.mjs` at blob `9c4587fb` against main's
  `84ec92d4`, with a third-file NEGATIVE control proving the instrument discriminates. **The path
  being on main is not the content being on main**, and 04 says it nearly filed the opposite from the
  `rev-parse` exit 0 alone.

**DISPOSITION: DISPATCHED** → **Station 03**, next occurrence `2026-09-21T23:00:45Z`. This is the same
hand-over my 02:08Z F-4 made, now carrying 04's blob-level evidence for `po-vg` and adding the
`po-fix-2005` prune and the 7-commit clone drift figure.
⚠️ Subject to `needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md`, as F-A
records — a dispatch in a Station 00 breadcrumb is measured not to arrive. All three items are also
printed in `status-sweep.ps1`'s `[LIVE]` section 2 every run, which is where 03 meets them without
reading me.

### F-D — 04's F6 and F8, deferred by 04 with triggers, confirmed rather than re-derived

- **F6, clone stash count 77** (dev tree 1), against **71** recorded in DOCTRINE §9.5 on 2026-09-10 —
  growth of 6 in 11 days. This is the launcher's auto-stash path working as designed; the stashes are
  its receipts. 04's trigger is the right one: it becomes urgent only if a preflight auto-stash
  **fails**, because that is the last remaining path by which a dirty clone refuses to start.
- **F8, `status-sweep.ps1` carries `-R` on 0 of its 7 `gh` invocations**, against §9.4's CWD rule.
  Mitigated today by that script's first `gh` call being a positive control that prints
  `[BROKEN] gh returned NO merged PRs` and skips the GitHub sections — so it fails **loud**, and the
  residual cost is the whole GitHub half of the report rather than a silently empty board.

I re-derived neither: both are `scripts/` changes outside my merge lane, both carry a named trigger,
and re-measuring a controlled measurement taken twenty minutes ago by a station whose job it is would
be spending the slot to agree with it. **DISPOSITION: DEFERRED**, triggers as 04 stated them.

### F-E — 04's F4 confirms the 00×04 overlap from the other side, and nothing collided

04 watched my worktree appear mid-run: `C:/po-wt/sup-20260921-0215` at 02:18:47Z, where its 02:17:09Z
registry read had shown none, and its 02:12:09Z sweep had said `no live station worktrees`. It
correctly classified this as Station 00 inside its own authority rather than a collision, re-read the
dev-tree index (**0** staged rows) before writing, and committed nothing.

**Condition 3 of BOARD DRIVING held in both directions and was checked in both directions.** I
checked `git diff --cached --name-status` before my own commit and found only my own rename; 04
checked the same index and found zero rows. The measured cost of the overlap this cycle is **zero** —
worth recording because `STATION-CAPABILITIES.md` §6 says it recurs on every one of 04's six daily
runs, and an open escalation asks Marco for two cron offsets. This is one more data point for that
ask, on the benign side.

**DISPOSITION: ACTIONED** — recorded, no action needed, and the escalation it feeds already exists.

### F-F — 04's F9: two controlled zeros, kept so the next run does not re-derive them

**0** tracked `*-ready.md` at depth 1 of `docs/pr-prompts` on `origin/main` (POSITIVE control returned
a tracked path; NEGATIVE control failed loudly), and **0 of 27** depth-1 HOLDs spent, from
`triage-holds.ps1` whose own SPENT bucket was proved reachable by fixture in the same run
(`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture`). No superseded, merged or
consumed prompt files are loose in the queue root.

⚠️ One nuance 04 flagged and left to me: `triage-holds.ps1` marks `pr-crmvis-s6-bulk-link-HOLD.md` a
**POSSIBLE DUPLICATE** of open `#2017`, 3 of 3 scope entries. **It is a true duplicate** — that prompt
is `#2017`'s own, which my 02:08Z run recorded from the other side, and arming it would build a second
PR for open work (DOCTRINE §10.6). It stays HOLD.

**DISPOSITION: ACTIONED.**

## WHAT I DID NOT DO

- **Did not delete any of the three superseded escalations**, and will not. Nothing in that queue is
  ever deleted; they carry banners and stay.
- **Did not delete, or ask any station to delete, a single remote branch.** Branch deletion is
  DOCTRINE §5.4 irreversible. The consolidated file is a question, not an action.
- **Did not touch `feat/crm-account360-v2-s1` (`#1612`) or `feat/scopecards-s3-line-markup-all-types`
  (`#2005`)**, and explicitly excluded both from the consolidation, because the correct action on
  them is preservation and the 2026-09-05 escalation warns that folding them in is how real work gets
  deleted.
- **Did not change the repository setting.** Enabling *Automatically delete head branches* is a
  settings change and Marco's alone, which is the whole reason the escalation exists.
- **Did not re-run 04's measurements.** Where we overlap we agree; where we do not, 04's are
  controlled and twenty minutes old.
- **Did not implement either half of 04's F7 option set** (F-B), and said why in the finding rather
  than leaving it implied.
- **Did not arm anything.** `armed` is still **0**.
- **Did not touch `#2017`** or its label.
- **Did not prune `C:\po-worktrees\po-fix-2005`** even though 04 proved it holds zero files —
  directory removal on the box is 03's lane (F-C).
- **Did not run `git` through the VM mount**, did not `git checkout .` / `checkout -- <dir>` /
  `reset --hard` / `stash pop` / `git clean`, did not commit on `main`, did not edit `/sot/`, did not
  write production data, did not touch Azure, Entra or SharePoint.
- **Wrote this breadcrumb inside an isolated worktree** (`C:\po-wt\sup-20260921-0235`, branch
  `docs/station-00-2026-09-21-0235-addendum`, off `origin/main` at `c3fb3add`), so no loose disk copy
  of it exists for the next fast-forward to trip over. **04's breadcrumb is a different case and I am
  naming it:** it was written into the dev tree by 04 and this PR lands that exact path, so the dev
  tree's untracked copy WILL block the next `--ff-only` and must be proved byte-identical to its
  `origin/main` blob with unpiped hashes and then removed — the documented cure, which this run
  performs and reads back three ways.
