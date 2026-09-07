# Station 00 — Supervisor | 2026-09-07T20:09Z–2026-09-07T20:5xZ

## GROUND

```
UTC            2026-09-07T20:09:02Z
origin/main    09029e36            (fetched, then rev-parse)
dev tree       main @ 58b99192 -> 09029e36 (fast-forwarded this run)  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. Sighted run — Desktop Commander reached the box on the first
`start_process`. All three binding documents were read in full; `git diff --numstat origin/main`
was EMPTY for `00-supervisor.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md`, so the working
copies are byte-identical to `origin/main` and reading them locally was sound (PREFLIGHT step 2).

vm-git-guard installer last line, quoted:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`

## WHAT I MEASURED

- [MEASURED] `status-sweep.ps1` captured to a file, exit 0, section 7:
  `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
  Instrument positive controls both passed (`gh` reached GitHub; `node` runs).
- [MEASURED] Board, 3 open PRs, all `BEHIND`:
  `#1790` (14 pass / 0 fail / 1 pending, no labels), `#1775` and `#1767` (13 pass / 2 fail each,
  both carry `do-not-merge`). The 2 reds on each of the latter are ONE cause — CP-26
  `[LABEL_PRESENT]` firing as both the required check and a step inside `PR gates — diff checks`
  (DOCTRINE section 9.4). Parked by design, not work.
- [MEASURED] RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`:
  2058 logs, newest `2026-09-07T19:53:55Z` — younger than the oldest open PR's `createdAt`
  (`#1767`, `06:43:58Z`) and younger than `#1790`'s (`19:45:50Z`), which is the freshness control.
  POSITIVE `marco.:true` -> 620. NEGATIVE, freshly minted needle `zzQq00N20260907T2015` -> 0.
  All three PRs read `NO LOG`.
- [MEASURED] Hand-classification by `classifyPolicyFiles` (`NO LANE VERDICT — hand-classified`):
  `#1790` touches `scripts/pr-watcher/index.mjs` -> outside the three `NESTED_TEST_PATHS` forms
  -> MARCO'S. `#1775` touches `apps/api/.../map-locations.service.ts`, `package.json`,
  `scripts/rates/...` -> MARCO'S. `#1767` carries
  `apps/api/prisma/migrations/20260907100000_tr1_reminder_policy_and_log/migration.sql` -> refused
  on the `(^|/)migrations/` clause -> MARCO'S. **MERGE NONE.**
- [MEASURED] COLLECT: `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0, all five rows `ok`.
  Crossed against `lastRunAt` from the scheduled-tasks MCP: 00 `20:08:33Z` (this run, prior run's
  breadcrumb is the 1908 one), 03 `2026-09-06T23:01:13Z` vs breadcrumb `2026-09-06-2302`,
  04 `18:10:11Z` vs `2026-09-07-1810`, 05 `14:11:15Z` vs `2026-09-07-1412`. **All four aligned;
  no new station breadcrumb has been written since my 19:08Z run, so there was nothing to collect.**
  `structure: 1 checked, 0 malformed`.
- [MEASURED] `#1774` MERGED `2026-09-07T19:50:20Z`, landing all four `scope:` entries of
  `pr-brandtheme-s2-hex-ratchet-HOLD.md`, including `docs/qa/hex-baseline.json`.
- [MEASURED] That prompt's premise is `! test -f docs/qa/hex-baseline.json`.
  `git cat-file -e origin/main:docs/qa/hex-baseline.json` -> exit 0 (POSITIVE control
  `sot-refs-baseline.json` -> exit 0; NEGATIVE control `zzQq00Ctl20260907T2035.json` -> exit 128).
  `Test-Path` on the dev tree's working copy -> **False** (same two controls, True / False).
- [MEASURED] `git rev-list --left-right --count HEAD...origin/main` -> `0  2`, and the two commits
  were exactly `09029e36 (#1777)` and `8d9a1c34 (#1774)` — the second being the one that created
  the file the premise tests for.
- [MEASURED] Duplicate cross-check over the ADMIT set against the 3 open PRs, directory entries
  matched as PREFIXES per DOCTRINE section 10.6's 2026-09-07 correction (POSITIVE control: a PR's own
  first file matches itself -> true; NEGATIVE control: a minted path -> false):
  three TRUE duplicates, confirmed on marker or full scope match —
  `pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate-HOLD.md` 2/2 vs `#1790`,
  `pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md` 4/4 vs `#1775`,
  `pr-tr-s1-reminder-policy-HOLD.md` 7/9 vs `#1767`; and three FALSE positives, all of them a
  single shared `apps/api/prisma/schema.prisma` (`pr-fv2-maintenance-usage-intervals` 1/5,
  `pr-sor-s9a-register-api` 1/7, `pr-524-rates-b-slice2-canonical` 1/5) — the zero-precision shape
  that correction names.
- [MEASURED] Lane classification of every ADMIT `scope:` against the three `NESTED_TEST_PATHS`
  forms (controls: `docs/pipeline/DOCTRINE.md` -> true, `apps/api/src/main.ts` -> false):
  **ZERO are tests-or-docs only.** Five are `gate_allow: migrations`; the rest name `apps/`,
  `scripts/`, `.github/workflows/` or `sot/`.
- [INFERRED] My ADMIT list for the two cross-checks above was extracted from the triage report by a
  line window and picked up **19** names where the GATES-SATISFIED bucket held **17** — the two
  extras (`pr-524-rates-b-slice2-canonical`, `pr-bp-s2-worth-chasing-view`) are REJECTs. Neither
  conclusion changes: `pr-524` produced one of the false positives already classified as false, and
  `pr-bp-s2` matched nothing. Recorded because an over-wide corpus that happens not to matter this
  run can matter the next one.

## WHAT CHANGED

- Fast-forwarded the dev tree `58b99192 -> 09029e36`. Index was clean and no tracked file was
  modified beforehand. All three prescribed read-backs afterwards: `HEAD...origin/main` -> `0  0`,
  `git diff --numstat` -> EMPTY, `git diff --cached --name-status` -> EMPTY.
- Retired `pr-brandtheme-s2-hex-ratchet-HOLD.md` to `docs/pr-prompts/superseded/` in this PR.
- Archived my own 19:08Z breadcrumb, every finding in it having carried a disposition.
- Nothing armed. Nothing merged. No label touched.

## FINDINGS

### F1 — A dev tree two commits behind offered a SPENT prompt as an arming candidate, and both triage runs exited 0

`lint-prompt.mjs` evaluates `premise:` against the WORKING TREE. At 20:20Z, with the dev tree 2
commits behind, `triage-holds.ps1` reported
`TOTALS  spent=0 of 45 evaluated  gates-satisfied=17` and listed
`pr-brandtheme-s2-hex-ratchet-HOLD.md` under `GATES SATISFIED — lint ADMITs (exit 0). CANDIDATES`.
After the fast-forward, the same script on the same board 20 minutes later reported
`TOTALS  spent=1 of 45 evaluated  gates-satisfied=16`, with that prompt under
`SPENT — premise already satisfied, the work has SHIPPED (lint exit 3)`.

Both runs exited 0, both printed their calibration line, and the SPENT fixture control passed in
both. Nothing was empty, so section 9.6 never fires. **Arming it would have opened a duplicate PR
for work that merged 20 minutes earlier** — and it is the one prompt on the board whose duplicate
was invisible to the open-PR cross-check, because its twin was already MERGED rather than open.

This is the standing stale-dev-tree trap, and until now this pipeline held it only as a warning.
The before/after pair above is the worked instance and is also its falsifying probe: run
`triage-holds.ps1` on a tree that is behind and again after the fast-forward, and if the SPENT
bucket does not change, this finding is wrong.

**DISPOSITION: ACTIONED.** Fast-forwarded first, then re-ran the triage and took its answer;
the retirement in this PR is that answer carried out. Verified by the two TOTALS lines quoted above.

### F2 — A fourth ADMIT prompt duplicates an open PR, and this one the lane opened 37 minutes ago

`#1790` (`fix/watcher-fixlane-s1-escalation-label`, created `19:45:50Z`) carries
`scripts/pr-watcher/index.mjs` and `scripts/pr-watcher/__tests__/escalation-label.test.mjs` —
2 of 2 of `pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate-HOLD.md`'s `scope:` entries. The
confirmation is the marker rather than the branch, as section 10.6 requires: the prompt asserts
`FIXES_PR_ESCALATION` four times and `#1790`'s title ends `(FIXES_PR_ESCALATION)`.

The prompt's premise is `! grep -q FIXES_PR_ESCALATION scripts/pr-watcher/index.mjs`, which stays
TRUE until `#1790` merges — so it will keep reading ADMIT for as long as that PR waits on Marco.
`#1790` also carries its own receipt at `docs/decisions/merge-approvals/1790.md` inside its own
diff, which is the supervised-cloud-lane signature under Marco's 2026-09-07 ruling.

**DISPOSITION: DEFERRED.** Do NOT arm it and do NOT retire it: retiring on an OPEN PR is what
section 10.6 forbids, because a close-unmerged makes the prompt live again. It becomes a retirement
the moment `#1790` merges. The same holds for `pr-tipid-s2-...` (`#1775`) and
`pr-tr-s1-reminder-policy` (`#1767`). It would become urgent if a run armed any of the three.

### F3 — Sixth consecutive run in which nothing armable can merge without Marco

Zero of the ADMIT prompts is tests-or-docs only, measured with controls this run. The `tests-docs`
auto-merge lane therefore still has no eligible supply, the board's three open PRs are all
hand-classified to Marco, and arming anything adds a fourth PR to his queue rather than moving the
board.

**DISPOSITION: ESCALATED — already open, not duplicated.**
`docs/pr-prompts/needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`,
filed at 19:0xZ, carries the options in RULE 1 order with `(a) give 06 a cron` first. This run adds
one measurement to it and no new file, because a second escalation on one cause is noise.

## WHAT I DID NOT DO

- **Armed nothing.** Every one of the 16 remaining ADMIT candidates stops at Marco, three of them
  duplicate an open PR, and five are `gate_allow: migrations`. Adding supply does not move a board
  whose constraint is a human gate.
- **Merged nothing, and removed no label.** All three open PRs hand-classify to Marco;
  `#1775` and `#1767` additionally carry `do-not-merge`, which only Marco removes.
- **Wrote no approval receipt.** A scheduled run may never author one, whatever `#1790`'s own
  receipt shows about the supervised lane.
- **Did not clear the 11 `[STALE]` lines** the sweep's section 5 reports, including my own
  `pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md`, which `#1777` merging has
  genuinely killed. `needs-marco/` is gitignored, so this is queue-file hygiene in the dev tree —
  Station 03's lane, and it is already inside the open clone-hygiene dispatch. Naming it again here
  rather than doing it myself.
- **Left `C:\po-vg` alone** — orphaned 5057 min, holding 1 uncommitted file. Already escalated;
  `git worktree remove` refuses it and `--force` would discard the work.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
