# Station 00 — Supervisor | 2026-09-04T03:09Z–2026-09-04T03:3xZ

## GROUND

```
UTC            2026-09-04T03:09:02Z  (start)
origin/main    b41fbea4 at start -> 400a3964 after this run merged #1564
dev tree       main @ cd06e4d1   C:\ProjectOperations2   (BEHIND origin/main all run; see WHAT I DID NOT DO)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

Versions AGREE — full authority this run, not read-only.

**Tree read in: `C:\ProjectOperations2` (the DEV TREE), never the watcher clone**, per
`station-contract v2`. `git fetch origin +refs/heads/main:refs/remotes/origin/main` ran FIRST.
`00-supervisor.md` was byte-identical between the working copy and `origin/main`
(`git diff --stat origin/main -- <path>` -> empty); `DOCTRINE.md` and `STATION-CAPABILITIES.md`
were NOT (39 and 60 lines behind), so both were read from `git show origin/main:<path>`.

`status-sweep.ps1` at 03:10:07Z: **CAUTION** — no local lock, but a PR had been touched on GitHub
within 2 min. Section 0 positive controls both PASSED. I re-measured every busy signal at 03:12:14Z
before mutating anything: `index.lock` dev/clone `False/False`, git processes `0`, in-progress
prompts `0`.

## WHAT I MEASURED

**M1. Reachability — SIGHTED, not blind.** `start_process` (`powershell.exe`) returned
`2026-09-04T13:09:02.0976364+10:00` and a working directory. Blindness did not occur this run.

**M2. RULE 2 probe, pinned to the live tree.** `C:\ProjectOperations2\docs\pr-prompts\processed`:
**1872** logs; newest `2026-09-04T03:10Z` (`pr-doctrine-s95-cite-symbol-not-line-ready.md.log`);
POSITIVE control `marco.:true` -> **606**; NEGATIVE control -> **0**. The newest log is younger than
every open PR, which is the discriminator that separates this directory from the dead decoy in the
clone (DOCTRINE §9.5). Both open PRs were queried by `PR #<n>` in the log **body**, not by filename.

**M3. `--freshness` is CLEAN and agrees with `lastRunAt`-shaped evidence.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit 0, `CLEAN`, 13 breadcrumbs checked,
0 malformed. 00 1.0h · 03 4.2h · 04 1.0h · 05 5.3h, all `ok`. Two `NOTE ... is UNTRACKED` lines, for
the 0209 supervisor and 0210 scanner breadcrumbs — both are committed by THIS PR, which is what
clears them. **No station is SILENT this run**, so escalation #23's recovery half did not fire and I
did not re-derive it.

**M4. `git status` in the dev tree shows the post-arm trace, in the SAFE shape.**
` D docs/pr-prompts/pr-doctrine-s95-cite-symbol-not-line-HOLD.md` — an UNSTAGED deletion, not the
`RD` shape the standing trap warns about, and `git diff --cached --name-status` was **empty** (no
other chat had staged anything; LL-38 collision check passed before I committed).

**M5. DOCTRINE §9.1's `-Command` trap reproduced, first-hand, this run.**
`... | ForEach-Object { ('{0,5} {1}' -f $_.LineNumber, ...) }` through `-Command` arrived with every
`$_` **removed**, producing eight cascading parser errors. Recorded as an independent reproduction of
a rule already in the canonical block; NOT filed as a finding. Everything after it went in a `.ps1`
run with `-File`.

**M6. The `origin/main` DOCTRINE.md blob is LF-only; the checkout is CRLF.** `CRLF=0 / bare-LF=793`
from `git show`, against `CRLF=792` on disk with `core.autocrlf=false`. A `.gitattributes` rule is
normalising on commit: `git diff --numstat` after my edit reads **`25  1`**, exactly the intended
change, so the CRLF asymmetry did NOT produce a whole-file diff. **Checked because §9.3 says a
numstat larger than your intended change is the symptom** — it was not.

**M7. The two `U+00E2 U+20AC` mojibake signatures in DOCTRINE.md are DELIBERATE, not damage.** (Named
by codepoint on purpose — writing the literal into a report is how the next encoding sweep finds it
twice and "repairs" a teaching example.) Both sit inside
§9.3 itself, as the literal worked examples of the double-encoding signature that section teaches you
to recognise. `U+FFFD` count **0**, before and after my edit. **Do not "repair" them.**

## WHAT CHANGED

1. **`#1564` MERGED** at `2026-09-04T03:14:29Z`. Read back: `{"state":"MERGED",
   "mergedAt":"2026-09-04T03:14:29Z"}`. Path: `gh pr update-branch` (returned *"already up-to-date"*
   — the watcher's `PR_WATCHER_AUTO_UPDATE` had already rebased it), then `pipeline-lib`'s
   **`Merge-Pr -PR 1564 -Auto`**, never a raw `gh pr merge` and never a hand merge.
2. **This PR**, carrying: the §10.3 correction; this breadcrumb; the 0210 scanner breadcrumb
   (untracked, would otherwise reach nobody); `docs/pipeline/sweep-rotation.json` (04 advanced it and
   **may not commit it** — if 00 does not, the sweep rotation silently stops repeating position 3);
   and the deletion of a spent HOLD (F4 below).
3. **Nothing else.** No prompt armed. No label touched. No branch, worktree, stash or lock deleted.
   `/sot/` untouched. Azure/Entra/SharePoint untouched.

## FINDINGS

### FINDING 1 — the `tests-docs` lane is NOT deadlocked; DOCTRINE §10.3 said it was for three days, and named no probe that would have caught it

The 02:09Z run built a **pre-registered discriminator** and deferred it to this run with the exact
probe, the exact window (`03:51Z`) and both branches of the outcome written down in advance. This is
the strongest evidence shape this pipeline has produced: the decision rule existed before the result.

**Branch 1 fired.** [MEASURED] `#1563` **auto-merged**:

| | [MEASURED] |
|---|---|
| opened | `2026-09-04T02:21:34Z` |
| native squash auto-merge enabled | `2026-09-04T03:09:09Z`, `enabledBy: GH-Mantova` |
| **merged** | **`2026-09-04T03:10:30Z`** |
| watcher verdict, log body | `[watcher] merge result for PR #1563: {"ok":true}` |
| files | `docs/pipeline/DOCTRINE.md`, `docs/pipeline/stations/_canonical-blocks.json` — both `docs/` |
| labels | `[]` |

Open-to-enable was **47.6 min**, inside the 90-min `MERGE_TIMEOUT_MS`. **Nobody reviewed it and
nobody hand-landed it.** Per the 02:09 run's own pre-written rule: *"If #1563 auto-merges -> the lane
works, and cause (b) — CI-creation latency — is the whole of the deadlock."*

**And the headline claim was already false for three days.** [MEASURED]
`Select-String -Path docs\pr-prompts\processed\*.log -Pattern 'merge result for PR #(\d+): \{"ok":true'`
against the pinned live tree -> **48** verdicts; negative control (`\{"ok":zzzNoSuchZzz`) -> **0**.
**Six are after #1400**: #1476 (09-01T04:29Z), #1514 (09-02T04:49Z), #1531 (09-03T06:29Z),
#1534 (09-03T07:02Z), #1537 (09-03T08:18Z), #1563 (09-04T03:10Z). DOCTRINE §10.3 has read
*"0 auto-merges since #1400"* since 2026-09-01 and was **already wrong when it was written** —
#1476 predates it by hours.

**What this does and does not settle.** It refutes *"the lane is dead"*. It does **not** touch the
mechanism: CI creation **can** outrun the window (#1500: 212.6 min), and when it does the timeout is
written **byte-identically** to a genuine policy routing, so a docs-only PR becomes permanently
human-gated and RULE 2 correctly forbids any station from clearing it. That is now the **whole** of
the remaining defect, and it is **latent and intermittent**, not a stopped lane.

Escalation #21's other three causes are unchanged and none is operative: (a) REFUTED 09-03;
(c) verdict-guard backtick path extractor and (d) `verdictApproves` column-0 anchor are both LATENT,
already staged, and neither was reached on #1563.

**DISPOSITION: ACTIONED — this PR.** §10.3's false sentence is replaced with the measurement, the six
post-#1400 verdicts, the #1563 worked instance, and — the part that would have prevented three days
of staleness — **the falsifying probe, named in the paragraph itself**. The `ok:true` count is the
probe; re-run it before quoting either half. This is a hand-landed correction to binding law, which
§10.3 itself names as the one case where hand-landing beats arming.

The remaining half is Marco's and is **not** newly escalated here — it is escalation #21 narrowed.
RULE 1, complete-and-additive first: **(a) make the wait latency-aware — start the 90 min when the
first check is CREATED, not when the PR opens, and cap the total wait separately.** Complete (fixes
every future latency spike, not just one), additive (it only ever extends a wait; it merges nothing
new and weakens no gate). **Both halves pass.** (b) Raise `MERGE_TIMEOUT_MS` to a flat larger number
— fixes the common case, fails the *future* half: 212.6 min already exceeded any round number anyone
would pick. (c) Write a DISTINCT timeout reason so a timeout stops impersonating a policy routing —
**necessary but not sufficient on its own**; it makes the failure legible without preventing it, and
Marco has already leaned this way. **(a) and (c) are complements, not alternatives.**

### FINDING 2 — the spent HOLD that #1563 did not delete, cured on its named instance

04's F4 caught this live at 02:2xZ: `pr-doctrine-s95-cite-symbol-not-line-HOLD.md` was armed, its
`-ready.md` twin is gitignored, and the HOLD **stayed tracked on `origin/main`**. #1563 has now
merged and touched only the two DOCTRINE paths — so the HOLD is still on main, its premise is now
FALSE (the `:1518` citation it existed to fix is gone), and any `git checkout` / `reset --hard` in
the dev tree would restore a spent prompt in an armable state.

**DISPOSITION: ACTIONED — this PR deletes it from `main`.** That closes this named instance. The
GENERAL defect — *any* armed prompt whose PR does not delete its HOLD stays armable forever — is
**unchanged and still DISPATCHED -> Station 06**, with 04's F4 as its dated reproduction case. Curing
one instance is not curing the class, and I am saying so rather than letting the ACTIONED read as a fix.

### FINDING 3 — collected from Station 04's 0210 breadcrumb; each finding dispositioned

Nobody else reads these. All five, in order:

- **F1 — `origin/fix1483`, a remote branch that never had a PR.** 04 proved with controls that it
  holds nothing `main` lacks (7 of 8 blobs byte-identical, the 8th because main is AHEAD; positive
  control on live branch `fix/agent-defs-double-encoded` gave identical=0/differs=9).
  **DISPOSITION: DEFERRED.** Deleting a remote branch is irreversible — DOCTRINE §5.4, a hard stop I
  do not reason past for a branch that is provably inert and costing nothing. The cure is already
  written and is not mine to shortcut: **tag `abandoned/fix1483@9de07267`, push the tag, THEN delete**,
  and take `C:/po-1483-fix` with it. It becomes urgent the moment `pr-hygiene-s1-guarded-branch-prune`
  is armed, because that prompt's regression case is this exact branch.
- **F2 — `status-sweep.ps1:192` cannot see `C:\po-work`, where a 22-day-old escapee sits.**
  **DISPOSITION: DISPATCHED -> Station 06** (04's own routing, which I confirm rather than re-route).
  Option (a) — derive the roots from the union of every parent named in `git worktree list` across
  both trees — is the complete-and-additive one; a literal `C:\po-work` string fixes today and is
  invisible to the next new root. Blast radius measured at 0 MB / 7 files, so this is a scanner
  coverage defect, not a disk problem.
- **F3 — DOCTRINE §9.2 tells you to `git stash drop` in the clone, and 6 of the 66 carry code**,
  one of them a 149-file / 14 617-insertion July WIP holding `schema.prisma` and 4 migration folders.
  **DISPOSITION: ESCALATED -> Marco, carried forward unchanged.** Correctly routed by 04 and I am not
  downgrading it: the edit lands inside the hash-gated `instruments v2` block (a governance change
  shipping all seven station docs), and the act it authorises is irreversible destruction of
  possibly-unique work (§5.4). The 66 stashes are inert; nothing needs doing today.
  ⚠️ Whoever implements it must handle 04's MEASURED-9: `git stash show` hides untracked files, so an
  untracked-only stash reads as empty.
- **F4 — the armed HOLD still tracked on main.** Instance ACTIONED here (FINDING 2); class remains
  **DISPATCHED -> Station 06**.
- **F5 — board trap clean** (0 tracked `*-ready.md` at depth 1 of `origin/main`; 0 SPENT of 80 HOLDs;
  both with passing positive controls). **DISPOSITION: ACTIONED** — recorded as a measured clean, which
  is worth as much as a defect, because *"nobody checked"* and *"checked, clean"* are otherwise
  indistinguishable to the next reader.

### FINDING 4 — the sweep's [STALE] cross-check now names 30+ dead PR refs across 8 `needs-marco/` files

Section 5 tags `tests-docs-lane-deadlock-2026-09-03.md` (7 dead refs),
`hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md` (12),
`station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md` (4),
`sot-only-pr-merge-authority-conflict-2026-09-03.md` (3), and four more. Two of these are now
substantively resolved as well as stale: the `sot-only` conflict was **ruled by Marco and landed in
#1562** (DOCTRINE §10.1 step 3), and the deadlock file's headline is refuted by FINDING 1.

**DISPOSITION: DEFERRED.** `needs-marco/` is gitignored (`.gitignore:76-83`), so an amendment there
reaches nobody but this box, and **deleting a file that carries an unanswered question is not mine to
do** — the standing rule is amend, never discharge, and only Marco discharges. What is missing is a
DURABLE channel for "this escalation's premise died", and the honest statement is that this run did
not build one. It becomes urgent when a run reasons from one of these files as current — which the
sweep now prevents on every run, which is exactly why this is DEFERRED and not ESCALATED.

## WHAT I DID NOT DO

- **Did not fast-forward the dev tree.** It sat at `cd06e4d1` behind `origin/main` for the whole run.
  Deliberate: 04's 0210 findings and the 0209 breadcrumb are UNTRACKED files in that tree, and the
  0209 run measured that `merge --ff-only` aborts on exactly this shape (*"untracked working tree
  files would be overwritten"*). Every doc read this run came from `git show origin/main:<path>`, and
  every mutation happened in the disposable worktree `C:\po-lane` off `origin/main`, so nothing I did
  depended on the dev tree being current. **The dev tree is still behind — the next run inherits it.**
- **Did not `git checkout .` / `reset --hard` / `stash pop` / `git clean` anywhere.** The dev tree
  holds a live ` D` of a spent HOLD and 16 untracked files; every one of those verbs resurrects
  dead prompts.
- **Did not arm anything.** Real armed count is **0** — `rev-1563-ready.md` and `rev-1564-ready.md`
  are auto-generated REVIEW JOBS (§9.5), not prompts, and both PRs are now merged. The board is
  **empty**, so there was nothing to unblock and no reason to lengthen the queue.
- **Did not touch the 5 orphaned worktrees, the 2 registry escapees, the 66 clone stashes or
  `origin/fix1483`.** All irreversible, none mine, all already routed.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
- **Did not re-derive escalation #23.** `--freshness` was CLEAN with every station inside cadence, so
  the false-SILENT machinery had nothing to fire on this run.
- **Did not run `git` through the device bridge against the Windows `.git`.** Everything went through
  Desktop Commander on the host.
