# Station 04 — Scanner | 2026-08-26T18:11:12Z–2026-08-26T18:27Z

## GROUND

```
UTC            2026-08-26T18:11:12Z
origin/main    549537a4            (fetched +refs/heads/main:refs/remotes/origin/main this run)
dev tree       main @ 7ad50697     C:\ProjectOperations2   (8 BEHIND origin/main)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE — this run was not read-only-by-mismatch.
Sweep this run: **gate-liveness** (`next-sweep.mjs` → rotation position 1 of 4; previous run
2026-08-26T14:11:31Z). Rotation advanced to `last_index=0` at the end of the run — see WHAT CHANGED.

## WHAT I MEASURED

### Reachability and instruments

- `[MEASURED]` Desktop Commander `start_process` shell `powershell.exe` returned
  `2026-08-27T04:10:43+10:00`. **This was a sighted run, not a blind one.**
- `[MEASURED]` Premise runner controls (gate-eval.mjs semantics, Git-for-Windows bash):
  `exit 0`→**PASS**, `exit 1`→**FAIL**, bogus command→**BROKEN**. All three states reachable.
- `[MEASURED]` `git show origin/main:<path>` controls: `package.json`→FOUND 3208b,
  bogus path→NULL. Both answers reachable.
- `[MEASURED]` Inverted control on 6 REAL premises (`if <premise>; then exit 1; else exit 0; fi`):
  all 6 flipped PASS→FAIL. So the 51/51 "still needed" reading below is a real reading, not the
  §7 failure mode of a runner that can only say one thing.
- `[MEASURED]` Missing-file control: `grep -q` on an absent path → exit 2 → correctly classified
  **BROKEN**, not FAIL. `test -f` on an absent path → exit 1 → **FAIL**. The tri-state holds.

### Board state

- `[MEASURED]` `status-sweep.ps1` 18:11:25Z: OPEN PRs **1** (#1337, CLEAN, 13 pass / 0 fail).
  armed `*-ready.md` at depth 1: **0**. needs-marco 12 · no-pr-opened 107 · failed 20 · blocked 0.
  No `index.lock` in either tree; 0 git processes; no PR touched in 2 min.
- `[MEASURED]` `git diff --cached --name-status` in the dev tree carries **one** entry, not mine:
  `R100 docs/pr-prompts/pr-sot-02-reconcile-2026-08-19-HOLD.md → …-ready.md` (Station 00's arm of
  16:42Z). That work has since **shipped as #1342, merged 17:54Z**, and the `-ready.md` is gone from
  disk — so the staged rename is now a residue pointing at a path that no longer exists. I did not
  touch it. `[INFERRED]` from armed=0 plus #1342's title matching the armed prompt.
- `[MEASURED]` Depth-1 inventory of `docs/pr-prompts/`: 146 `.md` files — **0** non-rev `-ready.md`,
  **0** `rev-*-ready.md`, **51** `-HOLD.md`, 95 other. **No tracked ready-file at depth 1** — the
  board trap is not currently sprung.

### The sweep — every HOLD's gates and premise against origin/main @ 549537a4

Evaluated with the watcher's own semantics (`stripQuotes` on the inline value, split on the FIRST
`" :: "`, fixed-string `includes`, `requires_merged` via `gh pr view --json state`).

- `[MEASURED]` 51 HOLDs. **33 carry a `requires_*` gate; 18 are ungated in front matter.**
- `[MEASURED]` **51 of 51 premises returned exit 0 = STILL NEEDED.** Zero FAIL, zero BROKEN.
  There is **no dead prompt on the board** and **nothing masked behind an unmet gate** (bucket D = 0).
- `[MEASURED]` **9 HOLDs have every `requires_*` gate RELEASED** (bucket A).
- `[MEASURED]` 4 premises read a working-tree file that differs between HEAD and origin/main
  (`ShellLayout.tsx`, `App.tsx`). Re-evaluated against `origin/main` **content** rather than the
  8-behind tree: all four give the **same** answer. The staleness did not change any verdict this run.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-26T18:11:12Z`.
  Read back: `last_index: 0`, `last_run_utc: "2026-08-26T18:11:12Z"`, `last_station: "04-scanner"`.
  **Next sweep is therefore `instrument-honesty`.**
  🔴 **NOT COMMITTED — deliberately.** The station contract says to commit it with the breadcrumb,
  but the dev tree is on `main`, 8 commits behind `origin/main`, and `CLAUDE.md` forbids committing
  directly to `main`. Committing here would fork a local `main` and block the next fast-forward.
  It sits as an unstaged working-tree edit for Station 00 to carry. See FINDING 7.
- Nothing else. **No prompt armed, disarmed, renamed, moved or edited. No prompt staged this run.**
  Scratch scripts written to `C:\po-sup-fix-scripts\` only (outside the repo).

## FINDINGS

### FINDING 1 — 9 HOLDs are gate-released; only 6 are actually armable  [S2]

`[MEASURED]` Every `requires_*` gate met against `origin/main` @ `549537a4`:

| HOLD | released gate | armable? |
|---|---|---|
| `pr-ew-s2b-alloc-engine-core-HOLD.md` | `capacity.service.ts :: getLeastLoaded` | ✅ **cleanest — tracked, no markers** |
| `pr-crm-wincount-s2-close-bypasses-HOLD.md` | `schema.prisma :: tenderWinCounted` | ✅ (escalates:true, touches prisma) |
| `pr-dns-s3-sot06-widgets-and-marker-HOLD.md` | `estimating-analytics-report.definitions.ts :: EA-D3` (released by #1339) | ✅ (escalates:true) |
| `pr-e2e-container-s2-swap-required-job-HOLD.md` | `playwright-container-trial.yml :: mcr.microsoft.com/playwright` | ✅ (escalates:true, has rollback_strategy) |
| `pr-fv2-maintenance-usage-intervals-HOLD.md` | `schema.prisma :: model AssetUsageReading` | ✅ (migrations ⇒ Marco at MERGE, not at RUN) |
| `pr-lessons-folder-s2-unfold-sot05-HOLD.md` | `docs/lessons-learned/README.md` present | ✅ (escalates:true) |
| `pr-pipeline-fold-s3-nav-any-permission-HOLD.md` | `ShellLayout.tsx :: PIPELINE_FOLDED` (released by #1334) | ❌ **UNTRACKED — see FINDING 2** |
| `pr-rates-consumers-s3a-export-only-HOLD.md` | `rate-resolver.service.ts :: listRates` | ❌ **UNTRACKED — see FINDING 2** |
| `pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md` | `requires_merged: 1111` = **MERGED** | ❌ **prose gate still live — see FINDING 3** |

Per DOCTRINE §5b, `escalates: true` gates the MERGE, not the RUN — it is not a reason to leave any
of these parked. Arming remains 00's call, one at a time.

**DISPOSITION: DISPATCHED** to Station 00 — six named, gate-verified, tracked candidates, in the
order above. `pr-ew-s2b-alloc-engine-core-HOLD.md` is the lowest-risk first arm: tracked, no
do-not-arm marker of any form, no prisma, and it unblocks four downstream HOLDs (`s2c`, `s2d`, `s3`,
`s4`) whose gates all point at the `allocation.service.ts` / `allocation.controller.ts` it creates.

### FINDING 2 — 5 HOLDs are UNTRACKED, and 2 of them are gate-released  [S2]

`[MEASURED]` `git ls-files docs/pr-prompts/` → 440 entries (positive control: non-empty). Set
difference against the 51 HOLDs on disk:

```
pr-hygiene-gitignore-no-pr-opened-HOLD.md
pr-pipeline-fold-s3-nav-any-permission-HOLD.md          <- gate RELEASED
pr-rates-consumers-s3a-export-only-HOLD.md              <- gate RELEASED
pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md
pr-watcher-idle-tick-liveness-HOLD.md
```

Arming is a `git mv` of a **tracked** path; `git mv` refuses an untracked one. So two prompts whose
gates have released are **structurally unarmable** until someone runs `git add` first. The set has
moved since it was last recorded (it was 4; `pr-rates-consumers-s3a-export-only-HOLD.md` is new and
`pr-pipeline-fold-s3-nav-any-permission-HOLD.md` has since had its gate release), which is the
argument for measuring it every run rather than carrying the list.

**DISPOSITION: DISPATCHED** to Station 00 — the cure is `git add <path>` **then** `git mv`, done
inside 00's own arming commit so the add and the rename land together. Station 04 is read-only on the
board and did not stage them.

### FINDING 3 — 4 arming gates live ONLY in prose, invisible to every automated reading  [S2]

`[MEASURED]` Do-not-arm markers exist on the board in **three distinct syntaxes**, and all 8
occurrences are genuine (none is the "Do NOT arm … as part of this PR" boilerplate that has
previously inflated this count):

| form | count | files |
|---|---|---|
| `<!-- watcher: do-not-arm ... -->` | 4 | `siteid-notnull-backfill`, `nav-jobs-projects-merge`, `ops-m2b-tipping-tab-reminder`, `vendor-invoice-ocr` |
| `DO NOT ARM` (upper) | 4 | `524-rates-b-slice2-canonical`, `ops-m2b-tipping-tab-reminder`, `retire-tenderclientnote-s2`, `vendor-invoice-ocr` |
| `Do NOT arm` (mixed) | 3 | `nav-jobs-projects-merge`, `rates-s11c-drop-legacy-tables`, `unified-api-key-vault-slice4c` |

Crossing that against the front-matter gate inventory:

- **3 HOLDs are gated ONLY by prose** — `pr-nav-jobs-projects-merge-HOLD.md` (waits on backlog
  B-P0a job/project model merge), `pr-ops-m2b-tipping-tab-reminder-HOLD.md` (waits on
  `pr-ops-m2-tip-finder` / `TipRecommendationLog`), `pr-vendor-invoice-ocr-HOLD.md` (waits on two
  PRs **and** on Marco entering a doc-AI key). All three read **UNGATED** to `requires_*` and
  **ADMIT** to the linter.
- 🔴 **1 HOLD has a RELEASED front-matter gate masking a LIVE prose gate**:
  `pr-unified-api-key-vault-slice4c-retire-old-screens-HOLD.md` — `requires_merged: 1111` is
  **MERGED**, so every mechanical reading says "promote me", while its body at `:35` says
  *"Do NOT arm while HOLD"* and it demands slice 4b be *merged AND verified* (nothing in this repo
  records *verified*). **This is the single most arm-able-looking trap on the board.**

**DISPOSITION: DISPATCHED** to Station 00 — before arming anything, grep the body for all three
forms, not just one. The union query that produced this table:
`t.includes('<!-- watcher: do-not-arm -->') || /\bDO NOT ARM\b/.test(t) || /\bDo NOT arm\b/.test(t)`.

### FINDING 4 — the standing positive control for the `DO NOT ARM` grep is FALSE  [S2, instrument]

`[MEASURED]` The control in long-standing use — *"grep `DO NOT ARM` case-sensitively; positive
control `pr-siteid-notnull-backfill-HOLD.md` → 1 hit"* — **does not fire**. That file contains no
occurrence of `DO NOT ARM`; its only marker is `<!-- watcher: do-not-arm -->` at line 25. A grep run
exactly as instructed returns 0 on its own positive control, which reads either as "my instrument is
broken, abandon it" or — worse, if the control is skipped — as "this file is armable."

**Correct control, measured this run:** `pr-524-rates-b-slice2-canonical-HOLD.md` → exactly 1 hit
for case-sensitive `DO NOT ARM` (line 27). Use that one.

**DISPOSITION: ACTIONED** — the false control is named and the working replacement is published
here. Nothing to fix in code; the fix is that the next reader uses the control above.

### FINDING 5 — `pr-queue-armed-tracked-detector-HOLD` is gated on an unrelated chain, while the drift it detects is live  [S2]

`[MEASURED]` Its gate is `requires_on_main: .github/workflows/ci.yml :: check-sot-refs`.
On `origin/main`: `ci.yml` is 12351 bytes and does **not** contain `check-sot-refs` (positive
control: it does contain `jobs:`); `scripts/pipeline/check-sot-refs.mjs` is **absent**. The only
queue prompt that would create that job is `pr-lessons-folder-s3-ref-checker-HOLD.md`
(`done_when` greps `ci.yml` for `check-sot-refs`), which is itself gated on
`docs/legacy-ai-providers-investigation.md`, produced by `pr-lessons-folder-s2-unfold-sot05-HOLD.md`.

So a **queue-hygiene** detector is parked two slices deep behind an unrelated **lessons-folder**
chain. The gate is not dead — it can release — but it is mis-scoped, and the cost is concrete:
the defect this prompt exists to detect is *"a `docs/pr-prompts/*-ready.md` that is untracked is
invisible to every station"*, and **FINDING 2 measured 5 untracked prompts on the board right now.**

**DISPOSITION: DISPATCHED** to Station 00 — recommend re-gating it on something it actually depends
on (its own `premise` is already `! test -f scripts/pipeline/check-armed-tracked.mjs`, which needs no
predecessor at all), or dropping the gate. Per the report-not-run rule I did **not** edit the prompt.
⚠️ Prompt (re)design is Station 06's lane and **06 has no scheduled task**, so a dispatch to 06 has
no reader — 00 should either action this itself or schedule 06.

### FINDING 6 — 5 slices are parked on a Marco-approval file that has never existed  [S3 → ESCALATE]

`[MEASURED]` `git ls-tree -r origin/main -- docs/approvals` returns exactly **one** entry:
`docs/approvals/README.md` (positive control: `docs/pipeline` returns 14 entries). Five HOLDs are
blocked solely on a sibling that has never been created:

```
pr-524-rates-b-slice2-canonical-HOLD.md        docs/approvals/rates-b-slice2-canonical-approved-by-marco.md
pr-rates-s11c-drop-legacy-tables-HOLD.md       docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md
pr-retire-tenderclientnote-s2-HOLD.md          docs/approvals/retire-tenderclientnote-s2-approved-by-marco.md
pr-siteid-notnull-backfill-HOLD.md             docs/approvals/siteid-notnull-backfill-approved-by-marco.md
pr-tenant-mt4-s2-ownership-migration-HOLD.md   docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md
```

All five premises are live (work still needed). The approval channel works exactly as designed —
it is holding destructive/ownership migrations back — but no approval has ever been filed through
it, so it is indistinguishable from a channel Marco does not know exists.

**Question for Marco, with RULE 1 applied** (*solve it completely, immediately and in future,
without damaging existing or future data entry*):

- **Option A (complete + additive — recommended).** Keep the file gate exactly as it is, and add a
  one-line index — `docs/approvals/PENDING.md` — that the scanner regenerates each run listing every
  HOLD currently waiting on an approval file. Nothing is unblocked automatically, no gate is
  weakened, no data is touched; the only change is that the waiting list becomes visible. Passes
  both halves of RULE 1.
- **Option B.** Marco writes the approval file for any of the five he wants to proceed. Solves the
  immediate case, **fails the "future" half** — the sixth one will sit unseen exactly like these five.
- **Option C.** Replace the file gate with a `needs-marco/` move. Fails the **"without damaging"**
  half: three of the five are destructive migrations (table drops, NOT-NULL backfill, ownership
  re-parenting), and `needs-marco/` is gitignored, so the gate would become invisible to `git`.

**DISPOSITION: ESCALATED** — Marco chooses A, B or C. Nothing proceeds without him either way.

### FINDING 7 — `04-scanner.md` contradicts itself, and contradicts `CLAUDE.md`, on two points  [S3]

`[MEASURED]`, reading the station doc:

1. The gate-liveness sweep brief (`sweep-rotation.json`, echoed by `next-sweep.mjs`) says
   *"**Repair** dead requires_merged / requires_file_on_main / requires_on_main gates"*. The
   AUTHORITY block of the same station doc says *"You arm nothing … you do not disarm, rename, move
   or delete any prompt either"*, and the ADVERSARIAL PROMPT CRITIQUE section says the rule is
   *"critical, non-negotiable … the scanner **NEVER** edits the prompt under critique"*. A gate lives
   in a prompt's front matter, so "repair the gate" and "never edit the prompt" cannot both hold.
   I obeyed the AUTHORITY block and reported instead (FINDING 5).
2. The station contract says *"commit that file with your breadcrumb"* for `sweep-rotation.json`.
   `CLAUDE.md` says *"Never commit directly to `main`"*, and the dev tree is on `main`, 8 behind.
   I advanced the file and left it uncommitted (WHAT CHANGED).

**DISPOSITION: DISPATCHED** to Station 00 — both need one docs PR against
`docs/pipeline/stations/04-scanner.md` and `docs/pipeline/sweep-rotation.json`: change "Repair" to
"Report, and hand the repair to 00/06", and say explicitly which actor commits the rotation file.
Station 04 may not open that PR itself.

## WHAT I DID NOT DO

- **Did not commit anything.** The dev tree's index is shared and currently carries Station 00's
  `R100` arming rename; the tree is on `main` and 8 behind. A commit here would either capture
  another chat's staged work or fork `main`.
- **Did not fast-forward the dev tree or the watcher clone.** Not Station 04's lane, and the sweep
  measured a live watcher (`pid 29024`, unchanged) — an FF under a running watcher is 03/00's call.
- **Did not touch #1337.** One open PR, CLEAN, 13/13 green. Prior runs recorded it as
  watcher-routed to Marco (`marco:true`), which is RULE 2 territory; Station 04 cannot merge in any
  case.
- **Did not act on the watcher clone.** `[MEASURED]` `status-sweep.ps1`: clone is on
  `feat/orphaned-discharge-guard`, **dirty=36**, not clean-on-main; 4 orphaned worktrees
  (`sot-d-register`, `sot-readme-fetch`, `sotk-03-ledger`, `po-wt-h`). Station 03's lane — reported,
  not repaired. This is not a new finding, it is a standing condition I re-measured.
- **Did not stage any prompt** (budget is 2/run; I used 0). Given FINDING 2 — five prompts already
  on the board untracked and therefore unarmable — adding a sixth file would have made the problem
  worse, not better.
- **Did not run Part 0 / Part 1 / Part 2** of the legacy brief. The station contract mandates ONE
  named rotated sweep covered completely; this run's was gate-liveness. Next run: `instrument-honesty`.

---

`[PROVENANCE]` Every `[MEASURED]` line above was obtained on the Windows host through Desktop
Commander PowerShell/node at 2026-08-26T18:11–18:27Z, against `origin/main` = `549537a4` and dev tree
`7ad50697`. Instrument controls for both the premise runner and `git show` are recorded under WHAT I
MEASURED and both produced their positive AND negative answers before any negative result below was
believed. Scratch scripts: `C:\po-sup-fix-scripts\gate-liveness-eval-v2.mjs`,
`premise-control.mjs`, `dead-gate-probe.mjs`, `dead-gate-probe2.mjs`, `marker-lines.mjs`.

🔴 **This breadcrumb is UNTRACKED until a board PR commits it.** Station 00: sweep it up, along with
the uncommitted `docs/pipeline/sweep-rotation.json` advance.
