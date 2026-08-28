# Station 04 — Scanner | 2026-08-28T02:10:25Z–2026-08-28T02:20:00Z

Sweep taken this run: **gate-liveness** (rotation position 1 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me). Rotation advanced with
`--advance --utc 2026-08-28T02:19:51Z`; `docs/pipeline/sweep-rotation.json` is modified and
**must be committed with this breadcrumb** or the next run repeats this sweep.

## GROUND

```
UTC            2026-08-28T02:10:25Z
origin/main    47aa0d28                    (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ faf3ff4c             C:\ProjectOperations2   (4 behind / 3 ahead of origin/main)
doc version    1                           (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                           (scheduled-task SKILL.md station_doc_version)
```

Versions agree — this run was NOT read-only-restricted.

## WHAT I MEASURED

- **[MEASURED]** Host reachable. `start_process` shell `powershell.exe` → PID 31312. Not a blind run.
- **[MEASURED]** `status-sweep.ps1` @02:10:54Z: instrument positive controls both pass
  (`gh` saw merged PR #1361; node runs). OPEN PRs **0**. main CI last 3 runs 3/3 success.
  Watcher node **RUNNING pid 12656**, wrapper alive (2), `index.lock` false/false, git processes 0.
  Verdict **SAFE TO ACT**.
- **[MEASURED]** Watcher liveness by the only probe that does not lie — **arm-to-pickup**.
  `pr-crm-s2-nav-three-items-tabs-ready.md` was consumed at 02:11:31Z and
  `pr-sot-refs-s1-baseline-ratchet-and-discovery-ready.md` was picked up ~02:12:26Z; the clone's
  `heartbeat.log` names it with `elapsed=300s` at 02:17:26Z. The watcher is alive and working.
- **[MEASURED]** Board at 02:19Z: 61 `pr-*.md` at depth 1 — 56 `-HOLD.md`, 1 `-ready.md`
  (`pr-sot-refs-s1-baseline-ratchet-and-discovery`, executing), 4 other. 18 HOLDs carry **no**
  `requires_*` gate at all; 37 carry one.
- **[MEASURED]** `lint-prompt.mjs` run over all 61 prompts, twice — once with the **dev tree's**
  copy, once with **origin/main's** copy extracted to a scratch dir and pointed at the dev tree via
  `LINT_REPO_ROOT`. Dev tree: 36 exit 0 / 23 exit 1 / 2 exit 3. origin/main: 28 / 31 / 2.
  **8 prompts flip ADMIT → REJECT.**
- **[MEASURED]** Positive control for the do-not-arm grep: `pr-524-rates-b-slice2-canonical-HOLD.md`
  matches the case-sensitive prose form (returns true), and the linter independently REJECTs it
  `[HUMAN_GATE_PRESENT]`. The instrument can produce a positive.
- **[MEASURED]** `triage-holds.ps1` covers only the two shepherd-merge HOLDs (#545, #548, both
  MERGED) plus an open-PR count. It is not a board-wide HOLD triage and did not contribute here.
- **[CANNOT MEASURE]** I did not attempt `git archive | tar` to materialise origin/main's scripts —
  the PowerShell pipe corrupts the binary stream (`Damaged tar archive (bad header checksum)`,
  ~18 000 retry lines). Extraction was redone through node `execFileSync` with `encoding: "utf-8"`.
  Recording it because it is a fresh instance of DOCTRINE §9.1: **never stream binary through a PS pipe.**

## WHAT CHANGED

1. **Staged one prompt as `-HOLD`** (my lane permits exactly this; it arms nothing):
   `docs/pr-prompts/pr-crm-s2-nav-three-items-tabs-HOLD.md`, restored byte-for-byte (3420 bytes,
   read back and compared) from the copy the watcher retired into the gitignored `processed/` folder.
   Read-back: file exists, armed count still **1** (`pr-sot-refs-s1…`, unchanged), and the path is
   already **tracked on origin/main**, so the restore returns the working tree to the main state.
2. **Advanced the sweep rotation** — `docs/pipeline/sweep-rotation.json` now reads
   `last_index=0 last_run_utc=2026-08-28T02:19:51Z`. Modified, not committed.
3. **Nothing else.** No PR touched, no merge, no arm, no rename, no `/sot/` edit, no index write.

## FINDINGS

### F1 — S2 — The dev tree's `lint-prompt.mjs` is 4 commits stale, so PR #1358's gate guard is INERT in the tree every station lints from

**[MEASURED]** `FILE_GATE_NOT_RELEASED` appears **9 times** in
`git show origin/main:scripts/pipeline/lint-prompt.mjs` and **0 times** in
`C:\ProjectOperations2\scripts\pipeline\lint-prompt.mjs`. `git rev-list --left-right --count
origin/main...HEAD` = `4  3`.

**[MEASURED]** Running both copies over the same 61 prompts, **8 HOLDs flip from ADMIT (exit 0) to
REJECT (exit 1) `[FILE_GATE_NOT_RELEASED]`**:

```
pr-rates-s11c-drop-legacy-tables-HOLD.md          <- drops legacy DB tables (irreversible)
pr-tenant-mt4-s2-ownership-migration-HOLD.md      <- production-data ownership migration
pr-ew-s4-capacity-board-api-HOLD.md
pr-fv2-ai-digests-HOLD.md
pr-fv2-output-channels-HOLD.md
pr-tr-s2-reminder-engine-HOLD.md
pr-tr-s3-manager-escalation-HOLD.md
pr-tr-s4-attention-worklist-HOLD.md
```

Proof for the sharpest one: `docs/approvals/` on origin/main contains **only `README.md`**, so
`docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` is absent. The dev-tree linter
answers `ADMIT (size 8)`; origin/main's linter answers
`REJECT [FILE_GATE_NOT_RELEASED]` naming that exact path.

This is the standing rule in its purest form: **a merged instrument fix is inert until the dev tree
gets it, and stations read the dev tree.** Two of the eight are destructive.

**DISPOSITION: DISPATCHED — Station 00.** Fast-forward `C:\ProjectOperations2` to `origin/main`
(4 commits) so the merged guard becomes live. It is a git write in the shared dev tree, which is
outside my lane. Until it lands, **treat every dev-tree `lint-prompt.mjs` ADMIT as unproven** — the
eight above are the measured false ADMITs. This is a second, independent data point for the open
escalation *"nobody owns dev-tree convergence"* (Station 00, 2026-08-28T00:08Z) and should be folded
into it rather than raised as a new question.

### F2 — S2 — A watcher agent produced a FALSE-NEGATIVE gate reading and self-cancelled an armed slice; the CRM cluster is now stranded

**[MEASURED]** `pr-crm-s2-nav-three-items-tabs-ready.md` ran 02:10:26Z → 02:11:30Z, **Exit 0**, and
opened **no PR**. Its run log (in the gitignored `processed/` folder, so it is not reportable
anywhere but here) says:

> `grep buildCreateNoteBody` in that file on `main` → **0 matches** … an absent `requires_on_main`
> symbol is a hard hold — I do not open the PR.

**[MEASURED] That reading is wrong.** At origin/main `47aa0d28`:

```
git show origin/main:apps/web/src/pages/crm/RelationshipsPage.tsx | grep -c buildCreateNoteBody   -> 2
git grep -c buildCreateNoteBody origin/main -- apps/web
  origin/main:apps/web/src/pages/crm/RelationshipsPage.tsx:2
  origin/main:apps/web/src/pages/crm/__tests__/crm-s1-body-builders.test.ts:11
```

The predecessor **S1 landed as #1356 at 2026-08-27T19:05Z**, seven hours before the run. Both
linters agree with me and disagree with the agent: relinting the identical body under a `-HOLD.md`
name gives `PROMOTE … GATE_RELEASED: requires_on_main "…RelationshipsPage.tsx :: buildCreateNoteBody"
is now on origin/main` from **both** the dev-tree and the origin/main copy, exit 0 each.

Consequence: a legitimately-armed slice was consumed with **exit 0 and no work done** — DOCTRINE §6's
"a silent success is indistinguishable from a crash", except here the watcher will file it as a win.
Ten HOLDs (`pr-crm-s3…s12`) are gated behind s2 and were left with no producer on the board.

**DISPOSITION: ACTIONED (partial) → DISPATCHED — Station 00 for the arm.** I restored the prompt as
`docs/pr-prompts/pr-crm-s2-nav-three-items-tabs-HOLD.md` (verified above). It is currently `??`
untracked while the index still carries the stale staged rename `RD  …-HOLD.md -> …-ready.md` from
the original arm. **00: run `git add -- docs/pr-prompts/pr-crm-s2-nav-three-items-tabs-HOLD.md`
first** — that collapses the stale rename back to no-change — **then arm by `git mv` as usual.**
Do not `git reset`; the index is shared. I did not arm it: arming is 00-only.

The false-negative itself is an **agent-side** defect, not a linter defect, and it is not fixable
from a prompt. It is worth 00 deciding whether the run template should be required to cross-check a
`requires_on_main` needle with `git show origin/main:<path>` rather than a bare `grep`, since the
same shape will recur on every gated slice.

### F3 — S3 — Three do-not-arm markers, three near-misses, on one line: `pr-nav-jobs-projects-merge-HOLD.md` ADMITs while saying do-not-arm twice

**[MEASURED]** An independent grep over all 61 prompts for the three known syntaxes finds **6** files
carrying an arm-block marker. The linter REJECTs **5** of them `[HUMAN_GATE_PRESENT]`. The miss is
`pr-nav-jobs-projects-merge-HOLD.md`, which gets `ADMIT (size 8)` from **both** linter copies.
Line 12 reads:

```
<!-- watcher: do-not-arm | GATED: arm ONLY after the Job/Project model merge (B-P0a, job-project-model-merge) has MERGED to main. ... -->
```

Against origin/main's three markers:

| marker | pattern | why it misses |
|---|---|---|
| 1 | `/<!--\s*watcher:\s*do-not-arm\s*-->/i` | extra text before `-->` |
| 2 | `/DO NOT ARM/` (case-sensitive) | the line never uses caps |
| 3 | `/Arm ONLY/` (case-sensitive on `Arm`) | the line says lowercase `arm ONLY` |

**[MEASURED] blast radius of the cure**: widening marker 1 to
`/<!--\s*watcher:\s*do-not-arm\b[^>]*-->/i` newly rejects **exactly 1** prompt — this one — and
nothing else on the board. Making marker 3 case-insensitive on `arm` adds **0** further rejections.

Note the deliberate non-finding: `pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md` says
"Do NOT arm while HOLD" in mixed case and is **correctly** not gated — origin/main's source comments
say so explicitly ("prose `Do NOT arm …` is not a gate"). Project memory currently records that
prompt with a red "DO NOT ARM"; that is not what any instrument enforces, and the memory line should
be corrected rather than acted on.

**DISPOSITION: DISPATCHED — Station 00 (or 06 to author it).** One-file change to
`scripts/pipeline/lint-prompt.mjs`, blast radius measured at one prompt. **RULE 1:** widening the
regex is the complete-and-additive option — it only ever adds a REJECT to a prompt a human already
marked, it cannot auto-arm anything, and it touches no data. The alternative, hand-editing
`pr-nav-jobs-projects-merge-HOLD.md` into the exact marker form, fails the *future* half: the next
author writing the same natural house-style comment reopens the hole.

### F4 — S3 — `requires_merged` is a legal dependency key that no instrument ever probes, so a HOLD gated on it can never surface as promotable

**[MEASURED]** In origin/main's `lint-prompt.mjs`, `requires_merged` appears only in
`LEGAL_DEP_KEYS`, in shape validation (`REQUIRES_MERGED_INVALID`), and in a comment stating it is
"IGNORED". Every `GATE_RELEASED` / `PROMOTE` emission comes from `checkFileGateDead` or
`checkDeadGate`, both of which read `requires_file_on_main` / `requires_on_main` only.

**[MEASURED]** Exactly one prompt on the board uses it:
`pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md`, `requires_merged: 1111`.
`gh pr view 1111` → `MERGED 2026-08-14T01:56:06Z`, title *"feat(admin-settings): SLICE-4b unified API
Keys vault UI"* — i.e. the exact predecessor the prompt body names. **Its gate released 14 days ago
and no instrument has said so, or can.** It reads as a plain `ADMIT`, indistinguishable from an
ungated HOLD — precisely the ambiguity #1358 was written to remove for the other two gate kinds.

**DISPOSITION: DEFERRED.** Real, and the fix is the same shape as #1358 (add a `requires_merged`
probe emitting `GATE_RELEASED`/`PROMOTE` when the PR is merged and a `MERGED_GATE_NOT_RELEASED`
REJECT when it is not). It becomes urgent the moment a **second** prompt adopts the key, or if 00
wants slice-4c moving. **RULE 1:** adding the probe is the complete-and-additive option — it closes
the hole for every future author and writes nothing. Deleting `requires_merged` from
`LEGAL_DEP_KEYS` would be faster but fails the *complete* half: it strands slice-4c and removes the
only gate form that expresses "wait for PR N" without naming a symbol.

### F5 — informational, no disposition needed — the two exit-3 prompts are already parked by filename

`pr-doctrine-s9-four-false-traps-LOOPING.md` and
`pr-user-default-dashboard-ui-RETIRED-premise-cannot-die-2026-08-18.md` both return exit 3 (STALE,
premise already satisfied). Neither ends in `-ready.md`, so neither is armable and neither is rot.
Recording so the next gate-liveness run does not re-file them.

## WHAT I DID NOT DO

- **Did not fast-forward the dev tree** (F1). It is the correct cure and I measured it precisely, but
  it is a git write in the shared tree where the watcher runs — outside my lane and the exact shape of
  LL-38. Dispatched with the SHA and the commit count so 00's action is transcription, not re-diagnosis.
- **Did not arm `pr-crm-s2-nav-three-items-tabs`**, and did not touch the git index to clean up the
  stale staged rename. Both are 00-only. I staged the `-HOLD` and stopped.
- **Did not edit `lint-prompt.mjs`** for F3 or F4, and did not edit
  `pr-nav-jobs-projects-merge-HOLD.md`. Reporting, not silently repairing, is the whole point of the
  adversarial-critique lane.
- **Did not run Part 2 (live-site visual patrol).** The rotation named `gate-liveness` and the
  station doc says cover ONE sweep completely; a shallow pass over everything is why findings rot.
- **Did not quote a trunk colour from `status-sweep.ps1` as authority** — I used it for the safe-to-act
  gate and the instrument controls, and measured the board facts I report directly.
- **Did not re-raise** the open escalations: 06 has no scheduled task (2026-08-26T16:09Z), 17 consumed
  prompts still tracked on main (2026-08-27T18:10Z), every CP gate advisory, the RULE-2 required-check
  cure. All open, none new this run.
- **Did not touch** any PR, `/sot/`, production data, or anything Azure / Entra / SharePoint.

---

**This breadcrumb is UNTRACKED until a board PR commits it. Station 00: sweep it up**, and commit
`docs/pipeline/sweep-rotation.json` **with** it or the next Station 04 run repeats `gate-liveness`
and the rotation silently stops.
