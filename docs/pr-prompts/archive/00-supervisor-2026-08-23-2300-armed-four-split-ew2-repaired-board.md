# Station 00 (Supervisor) - board repair and arming, 2026-08-23T22:36-23:00Z

**Authorised by Marco in chat**: "Arm today - 4 prompts: arm them", "pr-ew-s2-alloc-engine: break it
into smaller packages", "fix all the other prompts". This lifts RULE 4's arming hold for these
items only.

**Measured at** `origin/main` = `c17373121b7330dc48c3cbf114faa3ffa019576d`, dev tree
`C:\ProjectOperations2` 0 behind / 0 ahead, `index.lock` ABSENT in both trees, 0 git processes,
no mid-op HEAD, **watcher NOT running** (so nothing fired during this work).

All git ran through Desktop Commander on Windows. No `checkout`, no `reset`, no `clean`, no
`stash pop` was run at any point.

---

## 1. ARMED - 4 prompts, `git mv` of the tracked `-HOLD.md`

| Prompt | size | premise re-verified against origin/main |
|---|---|---|
| `pr-qa-env-example-fuelprice-sharepoint-legacy-ready.md` | 1 | `FUELPRICE_QLD_BASE_URL` and `SHAREPOINT_LEGACY_TENDERS_ROOT` both ABSENT from `.env.example` |
| `pr-qa-scanner-brief-instrument-corrections-ready.md` | 1 | wrong-direction sort sentence PRESENT, `SCANNER_BRIEF_CALIBRATED_2026_08_21` ABSENT |
| `pr-qa-backlog-discharge-fold-key-guard-ready.md` | 2 | backlog item still registered AND `FOLD_KEY_GUARD` already in `check-backlog.mjs` |
| `pr-lintgate-standing-authority-detector-ready.md` | 2 | `MISSING_STANDING_AUTHORITY` ABSENT from `lint-prompt.mjs` |

Controls: a token that must exist in `lint-prompt.mjs` returned true; a fake token returned false.
All four lint ADMIT individually. All four are docs/scripts-only.

WARNING: `pr-lintgate-standing-authority-detector` is **UNTRACKED** and `.gitignore:75` swallows
`*-ready.md`. It will run, but it is invisible to any clean worktree and leaves no trace when
retired. It needs landing via a docs PR.

## 2. EW-2 SPLIT - size 10 became four slices, strictly ordered

`pr-ew-s2-alloc-engine-HOLD.md` retired to `superseded/`. Replaced by:

| New slice | size | gate |
|---|---|---|
| `pr-ew-s2a-capacity-service-HOLD.md` | 3 | `schema.prisma :: model EstimatorCapacity` (OPEN - EW-1 #1274 landed) |
| `pr-ew-s2b-alloc-engine-core-HOLD.md` | 4 | `capacity.service.ts :: getLeastLoaded` |
| `pr-ew-s2c-alloc-rejection-path-HOLD.md` | 3 | `allocation.service.ts :: allocatePool` |
| `pr-ew-s2d-alloc-controller-HOLD.md` | 3 | `allocation.service.ts :: pushBack` |

Downstream gates repointed so the split cannot open them early:
`EW-3` -> `allocation.service.ts :: detectUnallocated` · `EW-4` -> `allocation.controller.ts` ·
`EW-5` -> `capacity.service.ts :: getAllEstimatorsSummary`. Their prose "Gate:" lines were
updated to match - a prompt whose prose contradicts its front-matter is a trap.

**Only `2a` is armable now.** Arm one at a time; fast-forward the watcher CLONE with the watcher
STOPPED between slices, or the merged fix stays inert.

## 3. AUTHORITY BLOCKS REPAIRED - 24 prompts (LL-53 / ITEM 2)

5 IMPOSTER -> GRANT (verbatim grant inserted directly under the heading, existing scope constraint
kept below it, per ITEM 2's prescription) and 19 NO-BLOCK -> GRANT (grant appended).
`git diff --numstat` confirms pure additions, 8/0 and 11/0, no CRLF churn.
Live imposters and no-blocks on the board: **0**.

Includes `pr-comms-hub-inbox`, which had **no block at all** - the measured cause of its Mode-B
death on 2026-08-20.

## 4. DEAD GATES REPAIRED - 14

Every predecessor was MEASURED present on `origin/main` first, with controls in both directions.
- 5 keys DROPPED where the dependency is genuinely satisfied and `cluster_order` is 1.
- 6 repointed to `requires_merged: <PR>` - `cluster_order > 1` REQUIRES a dependency key, and a
  PR-number gate is the one form the dead-gate detectors ignore. PR numbers read from the commit
  that introduced each predecessor artifact: **#1213, #1227, #1238/#1257, #1228, #1233**.
- 3 (later 5) repointed onto approval markers - see below.

## 5. NEW: `docs/approvals/` - "do not arm" becomes a real gate

**Measured defect:** eight prompts carrying a body-level `<!-- watcher: do-not-arm -->` or
`DO NOT ARM` line still linted ADMIT. `lint-prompt.mjs` cannot see either. The only thing that had
been stopping the destructive ones was an unrelated dead gate - an accident, not a control, and
repairing that gate would have silently removed the protection.

Five prompts now gate on `requires_file_on_main: docs/approvals/<slug>-approved-by-marco.md`, a
file nothing in any chain creates: `pr-524-rates-b-slice2-canonical`,
`pr-rates-s11c-drop-legacy-tables`, `pr-retire-tenderclientnote-s2`, `pr-siteid-notnull-backfill`,
`pr-tenant-mt4-s2-ownership-migration`. Convention documented in `docs/approvals/README.md`.
All five also had `escalates` corrected to `true` where it was wrongly `false`.

## 6. SCHEMA REPAIRS - 5

`pr-524` and `pr-siteid-notnull-backfill`: added the missing `rollback_strategy` (both destructive)
· `pr-siteid-notnull-backfill`: named the spec the slice must write, satisfying Gate A ·
`pr-fv2-formrule-contract`: added `backfill: false` and the two spec paths already edited by its
own step 8 · `pr-unified-api-key-vault-slice4c`: `requires_merged: "SLICE-4b-page"` -> **1111**
(SLICE-4b, merged 2026-08-14), which is exactly what its own body told the next station to do ·
`pr-ea-s2-dashboard-preset`: `escalates: true` + `backfill: false` (see the note in its front
matter - Marco can reverse this in one line).

## 7. RETIRED TO `superseded/` - 21 dead prompts

14 whose work is on main (8 apierr slices, `bp-s1` #1270, `ea-s1` #1272, `ew-s1` #1274,
`fv2-ai-describe` #1279, `rates-consumers-s4` #1258, `settings-home-s3-search` #1282), the
original `ew-s2` (split), `ratehub-s5` (#1281), and **five that only became visible once their
dead gate stopped masking the premise**: `fix-watchdog-kill-churn-halt` (#1252 shipped
`watchdogKillTimes`), `lintgate-s2-file-gate-dead-rule` (#1253 shipped `FILE_GATE_DEAD` - I had
already seen it reject eight prompts with that code), `rates-consumers-s2-tendering` (#1257),
`settings-home-s2-home-page`, `waste-transport-variance-ui` (#1285).

Positive control: `rates-consumers-s3-persona-export` uses the same premise family and stayed
LIVE, so the instrument still discriminates.

Also renamed `00-04-scanner-2026-08-22-1215-...-invisible-HOLD.md` -> `...-invisible-hold-prompt.md`:
a breadcrumb whose filename ended `-HOLD.md` was being linted as a prompt.

## 8. BOARD AFTER

```
armed(depth 1)  4      (was 0)
HOLD (depth 1)  51     (was 72)
lint over all 55 queue files:  ADMIT 55 | STALE 0 | REJECT 0     (was ADMIT 40 | STALE 14 | REJECT 19)
live imposter / no-block authority blocks:  0 / 0                (was 15 / 19)
mojibake or BOM in the 44 changed files:    0 / 0   (control fires on real mojibake)
```

## 9. STILL FOR MARCO

- **The watcher is dead and nothing on the box restarts it** - fourth death in three days, last
  one a SIGINT at 2026-08-22T02:35:21Z. Arming does nothing until it is relaunched.
- **Nothing here is committed.** These are working-tree changes in a shared tree.
- `pr-ew-s5-capacity-board-ui` is still size 8 and `pr-sor-s9` size 9 - not split, not asked for.
