# Station 04 — Scanner | 2026-08-31T10:10Z–2026-08-31T10:26Z

## GROUND

```
UTC            2026-08-31T10:10:25Z
origin/main    4ea28d6d   (4ea28d6da44213ff9666e6f1aed154460bd33e5b)
dev tree       main @ 4ea28d6d   C:\ProjectOperations2   (0 behind / 0 ahead, index EMPTY, 1 worktree)
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — full authority, not read-only-by-mismatch.

SIGHTED. `start_process` shell `powershell.exe` returned `LAPTOP-E6NHU4E4` and a clock.
This was **not** a blind run.

**Sweep this run: `gate-liveness` (rotation position 1 of 4)** — `node scripts/pipeline/next-sweep.mjs`,
exit 0, previous run 2026-08-31T06:10:32Z.

---

## WHAT I MEASURED

**Doc freshness.** [MEASURED] `git diff --stat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **empty**, and
`git status --porcelain -- docs/pipeline` → **empty**. The working copies of all three binding
documents are byte-identical to `origin/main` at 4ea28d6d, so reading them from disk was equivalent
to `git show origin/main:`.

**Shell calibration (DOCTRINE §9.1).** [MEASURED] `powershell.exe -Command "... $LASTEXITCODE"` died
with `ExpectedValueExpression` — the `$` was eaten by the `-Command` layer, exactly as §9.1 records.
Switched to a persistent session driven by `interact_with_process`; control `"CTRL=42"` echoed
verbatim, confirming that path does **not** expand `$`. Every reading below came through that path.

**Sweep verdict.** [MEASURED] `status-sweep.ps1` 10:11:09Z — section 0 controls both PASS
(`gh` reached GitHub, saw merged #1446; `node` runs). §7 **SAFE TO ACT**. Watcher node RUNNING
**pid 32916**, auto-restart wrapper alive, heartbeat age **1 min**, **watcher clone dirty=0**,
orphaned worktrees none, guard hook present. `git index.lock` false/false, git processes 0,
in-progress prompts 0. Open PRs 2 (#1447 BLOCKED 11p/0f/2pending; #1443 BLOCKED 12p/1f **RED**).
Armed on disk: **1** — `rev-1447-ready.md`, an auto-generated review job (DOCTRINE §9.5: excluded
from prompt audits by design).

> ⚠️ Note for whoever holds the standing amber: `watcher clone: dirty=35` is **no longer true** —
> it read **dirty=0** this run. The permanent-amber note has expired; re-measure before repeating it.

**HOLD triage.** [MEASURED] `triage-holds.ps1` at 4ea28d6d, both its own controls PASS
(GIT control read DOCTRINE, 37206 chars, so gate probes could actually run; SPENT control emitted
exit 3 on the fixture, so the SPENT bucket was measurable):

```
TOTALS  spent=2  gates-satisfied=32  still-gated=28  unreadable=0  of 62
```

Previous recorded reading was `spent 0 / satisfied 30 / gated 30 of 60`. **`spent` moved 0 → 2.**

**Premise runner is sound.** [MEASURED] `lint-prompt.mjs:1174 runPremise` uses `findBash()`;
`Test-Path "C:\Program Files\Git\bin\bash.exe"` → **True**, so the fail-safe branch (`!BASH` →
`broken:true` → REJECT) was not taken. `broken` covers status −1/127/126/2 and the
`command not found` stderr shapes, so a spawn failure REJECTs rather than bins. The §7-lie-#3 shape
is closed. (`grep` does **not** resolve on PowerShell's PATH — irrelevant, lint spawns its own bash.)

**All eight `requires_merged` targets are MERGED.** [MEASURED] `gh pr view --json state,mergedAt`:
#1350 · #1361 · #1317 · #1421 · #1351 · #1348 · #1257 · #1111 — **8 of 8 MERGED, 0 CLOSED**.
There is **no dead `requires_merged` gate on the board.**

**All `requires_on_main` / `requires_file_on_main` targets resolve honestly.** [MEASURED] against
4ea28d6d with `git show` / `git cat-file -e`, controls `docs/pipeline/DOCTRINE.md` → PRESENT and
`docs/pipeline/NO-SUCH-FILE-CONTROL.md` → absent. Every prompt lint calls STILL GATED has a needle
or file that is genuinely absent; every prompt lint ADMITs has one genuinely present. **Zero
disagreement between the linter's verdict and an independent read.** The 11 absent file-gate targets
are 5 Marco approval receipts (by design) + 6 successor files whose producing prompts are live on
the board. **No gate is dead-by-typo.**

**THE BOARD TRAP: clean.** [MEASURED] tracked depth-1 `*-ready.md` on origin/main = **0**, against a
positive control of **77** tracked depth-1 files (`git ls-tree -r --name-only <SHA> -- docs/pr-prompts/`,
filtered by path depth in node — never by a glob pathspec, per §9.2).

**`docs/approvals/` census.** [MEASURED] 1 tracked file, `README.md`, against a positive control of
**825** tracked files under `docs/`. Its "Currently gated on an approval marker" table names exactly
the 5 prompts my front-matter scan found carrying `requires_file_on_main: docs/approvals/…` — **5 of
5, no drift** in the table itself.

**Lead, not a finding — `cluster: estimating-pricing` has no `cluster_order: 3`.** [MEASURED] orders
1, 2, 4, 5 exist; no `pr-estpricing-s2` is tracked anywhere under `docs/pr-prompts/`.
[MEASURED] `git grep cluster_order -- scripts/` — `lint-prompt.mjs:211-262` treats `cluster_order`
as a position that must be a positive integer with a dependency key when >1. **Contiguity is not
enforced anywhere.** A gap is legal. Recording it so the next run does not re-chase it.

---

## WHAT CHANGED

Nothing on the board. **Zero mutations.** No prompt was armed, disarmed, renamed, moved, staged or
deleted; no PR was merged, labelled or touched; no `/sot/` file was read-modify-written.

Two artefacts written, both **untracked**, for Station 00 to collect:

1. this breadcrumb, at `docs/pr-prompts/` (tracked directory, untracked file — matches no watcher glob);
2. `docs/pipeline/sweep-rotation.json`, advanced by
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-31T10:11:04Z`.

Scratch used and removed: `C:\po-sup-fix-scripts\sc1011\` (two throwaway lint fixtures).
No worktree was minted (AUTHORITY: read `origin/main` with `git show`, never `/tmp/po-scan-*`).

---

## FINDINGS

### F1 — TWO HOLD prompts are SPENT: the estimating-pricing snapshot slices already shipped · S3

`triage-holds.ps1` reports lint exit 3 (premise already satisfied) for:

- `pr-estpricing-s1-tender-rate-snapshot-HOLD.md` — premise
  `! grep -q "TENDER_RATE_SNAPSHOT_APPLIED" apps/api/src/modules/rates/rate-resolver.service.ts`
- `pr-estpricing-s1b-snapshot-reaches-pricing-HOLD.md` — premise
  `! grep -q "SNAPSHOT_LIST_APPLIED" apps/api/src/modules/rates/rate-resolver.service.ts`

**Verified independently of the linter** [MEASURED], reading the blob at 4ea28d6d in node and
counting occurrences, with a negative control:

```
TENDER_RATE_SNAPSHOT_APPLIED       => 2
SNAPSHOT_LIST_APPLIED              => 4
THIS_TOKEN_DOES_NOT_EXIST_CONTROL  => 0        (file 39983 bytes)
```

Both tokens are on `main`. s1 landed as **#1421** (merged 2026-08-31T03:12:06Z); s1b's own body
documents that s1 was authored against the wrong function, and its replacement token is now present
four times. **The work these two prompts describe is done.** They are finished work still sitting on
the board — the exact class this sweep exists to find. Leaving them is not neutral: `pr-estpricing-s4`
is ADMIT in the same cluster, and a stale predecessor invites someone to arm a no-op run.

Retiring them to `docs/pr-prompts/superseded/` is a board mutation, which is not my lane.

**DISPATCHED → Station 00.** Retire both to `docs/pr-prompts/superseded/` in the next board PR.
Re-run the two greps above first — a SPENT verdict expires as it prints.

### F2 — SEVEN consumed HOLD prompts are tracked on main but ABSENT from disk, deletion uncommitted · S2

[MEASURED] `git status --porcelain` shows exactly seven ` D` entries, and a node existence check
against the tracked set agrees: **69 depth-1 `-HOLD.md` tracked at 4ea28d6d, 7 missing from the
working tree** (control: `docs/pipeline/DOCTRINE.md` exists → true).

```
 D docs/pr-prompts/pr-arm-guard-hook-HOLD.md
 D docs/pr-prompts/pr-arm-prompt-release-index-HOLD.md
 D docs/pr-prompts/pr-crm-s8-register-and-followups-HOLD.md
 D docs/pr-prompts/pr-estpricing-s3-rate-table-step-lists-HOLD.md
 D docs/pr-prompts/pr-scopesub-s2-sub-discipline-HOLD.md
 D docs/pr-prompts/pr-watcher-conflict-escalation-HOLD.md
 D docs/pr-prompts/pr-watcher-onmain-dispatch-gate-HOLD.md
```

Two consequences, both measured:

1. **THE BOARD TRAP is armed against these seven.** They are tracked on `origin/main`; any
   `git checkout .` / `checkout -- docs/pr-prompts` / `reset --hard` / `stash pop` / `git clean`
   restores seven consumed prompts to the queue root, and five of them describe work already merged.
2. **`triage-holds.ps1` cannot see them.** It globs the **disk** (`62 *-HOLD.md at depth 1`) while
   `origin/main` carries **69**. Every board triage this week has been reporting on a set seven
   prompts smaller than what a checkout would produce, and nothing in the report says so.

**The merged/mid-lane split is now measured, which is what was missing before.** The mapping below is
[MEASURED] from the **watcher's own `docs/pr-prompts/processed/<prompt>-ready.md.log`** — positive
control: 3672 entries in `processed/`, and every one of the seven logs carries a `PR #N` line, so the
instrument demonstrably produces positives. (An earlier probe — grep the slug out of
`gh pr view --json title,body,headRefName` — was **discarded**: it returned "no" for all seven **and
for its own negative control**, so it could not distinguish and proved nothing. §7.)

Five have already merged and their deletions are safe to commit today:

| ` D` prompt | landed as | merged |
|---|---|---|
| `pr-watcher-onmain-dispatch-gate` | #1438 | 07:27Z |
| `pr-arm-prompt-release-index` | #1442 | 08:16Z |
| `pr-estpricing-s3-rate-table-step-lists` | #1440 | 08:51Z |
| `pr-arm-guard-hook` | #1445 | 09:14Z |
| `pr-watcher-conflict-escalation` | #1446 | 09:32Z |

Two are **mid-lane with an open PR** and must wait — committing their disappearance removes the only
restorable copy while the lane can still fail:

| ` D` prompt | open PR | state |
|---|---|---|
| `pr-crm-s8-register-and-followups` | **#1447** | BLOCKED, 11 pass / 0 fail / 2 pending |
| `pr-scopesub-s2-sub-discipline` | **#1443** | BLOCKED, 12 pass / **1 fail** |

This supersedes the standing "six ` D` deletions, commit when the lane is idle" note: it is **seven**,
and the lane does not have to be idle for five of them.

**DISPATCHED → Station 00.** Commit the five merged deletions now, with a pathspec commit
(`git commit -- <the five paths>`) because the dev-tree index is shared (§9.2). Hold the two mid-lane
ones until #1447 and #1443 settle. Re-run `git status --porcelain` immediately before committing —
the set grows every time a prompt is consumed.

### F3 — `docs/approvals/README.md` states a defect the linter has since fixed, and its arming step is wrong for 3 of the 5 prompts it names · S3

The README's "The defect this exists to close" says, of body-level do-not-arm markers:
**"`lint-prompt.mjs` cannot see either of them"**, measured 2026-08-23.

[MEASURED] That is no longer true at 4ea28d6d, with a negative control:

```
DO_NOT_ARM_COMMENT => 2   (:728  /<!--\s*watcher:\s*do-not-arm\s*-->/i)
DO_NOT_ARM_CAPS    => 2   (:730  /DO NOT ARM/)
HUMAN_GATE_PRESENT => 8   (:741 code, :743 message)
NO_SUCH_CONST_CONTROL => 0
```

and live on the board this run, **7 prompts REJECT `[HUMAN_GATE_PRESENT]`** — matching the count
DOCTRINE §9.5 records for the two markers.

The operational half is the part that bites. `checkHumanGate` is called at `lint-prompt.mjs:1227`;
the file-gate probe at `:1326`. **The human gate hard-REJECTs first.** Proved empirically rather than
by reading, in scratch, with a control:

```
CONTROL  ctl-unmodified-HOLD.md  -> REJECT [FILE_GATE_NOT_RELEASED]   exit 1
EXPERIMENT exp-with-marker-HOLD.md -> REJECT [HUMAN_GATE_PRESENT]     exit 1
```
(the experiment is the same file with one `DO NOT ARM` line injected into the body)

Of the five approval-gated prompts, **three also carry a body marker** and therefore currently
reject on `HUMAN_GATE_PRESENT`, not on the approval gate: `pr-524-rates-b-slice2-canonical`,
`pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`. The other two —
`pr-rates-s11c-drop-legacy-tables`, `pr-tenant-mt4-s2-ownership-migration` — reject on
`FILE_GATE_NOT_RELEASED` as the README describes.

**So README step 3 — "Arm the prompt normally" — is incomplete for those three.** If Marco lands
`docs/approvals/<slug>-approved-by-marco.md` and follows the README, lint still REJECTs and the arm
fails; the body marker must be removed as well. The README does not say so, precisely because it was
written believing the linter could not see body markers. A granted approval that does not release is
a stale instruction with a wasted human step attached.

This is defence-in-depth working correctly on three irreversible-migration prompts, so the code is
**not** the thing to change. The document is.

**DISPATCHED → Station 06 / Station 00** (whoever next opens a docs PR; `docs/approvals/` is not
`/sot/`, so this needs no 05 doc-reconcile and no CP-24 split). Two edits, both additive:
(1) re-date the "defect" section to say the linter **now** sees both markers and REJECTs
`HUMAN_GATE_PRESENT` at `:728`/`:730`, citing DOCTRINE §9.5 rather than restating it; (2) add to
"Granting an approval" a step between 2 and 3: *"if the prompt body also carries `DO NOT ARM` or
`<!-- watcher: do-not-arm -->`, remove that line in the same PR — the human gate is evaluated before
the file gate and will refuse the arm on its own."* I did not write this myself: the ADVERSARIAL
PROMPT CRITIQUE report-not-run rule forbids me editing another station's artefact, and RULE 1's
complete-and-additive test is satisfied by the two-edit version, which fixes today's wrong step and
stops the next reader re-deriving the precedence by hand.

### F4 — the `spent` bucket is the only number on this board that nobody re-reads · S4 (opportunity)

`triage-holds.ps1` prints `spent=N` and a one-line instruction to retire them, and nothing consumes
it. `spent` sat at 0 across several recorded runs and moved to 2 today; F1 is only visible because
this run happened to be the gate-liveness rotation slot. A prompt can be SPENT for days between
Station 04's four-hourly rotation hitting position 1.

The cheap complete-and-additive fix is to have `status-sweep.ps1` §6 print the `spent` count (it
already shells out to `node` for the backlog gate), so every station that runs a sweep — which is
every station, every run — sees a non-zero `spent` immediately instead of once per rotation cycle.
The alternative, raising 04's gate-liveness frequency, fails the future half of RULE 1: it narrows
the other three sweeps to buy the same signal.

**DEFERRED.** It becomes urgent the first time a SPENT prompt is armed and burns an agent run — at
which point the cost is a full watcher cycle, not a report line. Not now because `spent=2` is
currently dispatched in F1 and the board is otherwise healthy.

---

## WHAT I DID NOT DO

- **Did not retire, move, rename, arm, disarm or delete any prompt.** Station 04 is READ-ONLY on the
  board; F1 and F2 both end in a dispatch to 00 for that reason.
- **Did not commit the seven ` D` deletions**, though I measured which five are safe. That is a board
  mutation in a shared index, and it is 00's.
- **Did not edit `docs/approvals/README.md`** (F3) — the ADVERSARIAL PROMPT CRITIQUE report-not-run
  rule: a silent auto-fix poisons the review it exists to enable.
- **Did not run Part 0 (static cross-layer audit) or Part 2 (live-site visual patrol).** The station
  doc's AUTHORITY section is explicit that the ONE named sweep from `next-sweep.mjs` is covered
  completely and is not my choice; this run's slot was `gate-liveness`. Rotation advanced so the next
  run does not repeat it.
- **Did not stage a fix prompt.** Nothing found this run needs new code: F1 and F2 are board hygiene,
  F3 is a documentation correction, F4 is a deferred opportunity. Staged-prompt budget 2, used 0.
- **Did not touch Azure / Entra / SharePoint, `/sot/`, production data, or the watcher clone.**
- **Did not clear any lock** — there were none to clear (`index.lock` false/false, 0 git processes).

---

*Stamped at `origin/main` **4ea28d6da44213ff9666e6f1aed154460bd33e5b**, UTC 2026-08-31T10:26Z.
Every verdict above expires as it prints — re-measure before acting (§7, and the 161-second
watcher).*
