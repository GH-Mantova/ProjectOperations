# Station 00 — Supervisor | 2026-09-07T15:08:56Z–2026-09-07T15:5xZ

**SIGHTED.** `start_process` shell `powershell.exe` returned pid 2740 first try, after a keyword
`ToolSearch` for `desktop-commander` (schemas arrive deferred; a cold call is an unloaded schema,
not blindness). The immediately preceding 00 occurrence, 14:09Z, was BLIND — a controlled
blind/sighted pair one hour apart on one machine, which is the second such pair in two hours.

## GROUND

```
UTC            2026-09-07T15:08:56Z
origin/main    f9815d11  at run start  ->  2e4f6315 after this run merged #1783
dev tree       main @ f9815d11 at start (0 0 vs origin/main), fast-forwarded to 2e4f6315 mid-run
doc version    1         docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1         station_doc_version declared by the scheduled-task file
```

Doc version and bootstrap **MATCH** — this run is not read-only-by-mismatch.

Device-bridge git guard, quoted as the contract requires. Last line of
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

All three binding documents read **in full** this run (00-supervisor.md 1299/1299 lines,
DOCTRINE.md 1638/1638, STATION-CAPABILITIES.md 437/437) from the dev tree, where
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** — the sound form, no piped hash (§9.1).

Fresh needles minted this run: `zzQq00Needle20260907T1520`, `zzQq00Needle20260907T1545`. **Both are
spent the moment this file is committed — the next run mints its own** (§9.6).

## WHAT I MEASURED

**Sweep, captured to a file** (it returns early and hides its own §7 verdict otherwise).
`status-sweep.ps1` run twice: `SWEEP COMPLETE 2026-09-07 15:10:49Z` and, re-run immediately before
the merge, `SWEEP COMPLETE 2026-09-07 15:16:59Z`. Both: section 0 controls `[LIVE]` with **no
`[BROKEN]`**; section 3 `index.lock` False/False, `git processes running: 0`, `no PR touched on
GitHub in the last 2 min`; section 7 **`[LIVE] SAFE TO ACT`**. Watcher node **RUNNING pid 31660**,
wrapper alive (1), heartbeat 40–46 min (idle, not wedged — empty queue). Backlog
`ready=1 needs-marco=2 blocked=4 broken=0`. main CI on `f9815d11`: 4 success / 0 failed.

**COLLECT — three breadcrumbs since my last run, all read in full.** `[MEASURED]`
`check-breadcrumb.mjs --freshness` at run start: `structure: 4 checked, 1 malformed`, **exit 1**.
Two files were untracked in the dev tree; both were confirmed genuinely unreported by asking the
**tracked set** rather than the dev tree (`git ls-files docs/pr-prompts`, matched by basename) —
`0` hits each, POSITIVE control `00-04-scanner-2026-09-07-0610-*` → `1` hit in `archive/`. The
third, 05's, shipped inside its own PR `#1783` and was read from `origin/main` after that merge.

| breadcrumb | findings | dispositioned below |
|---|---|---|
| `00-00-supervisor-…-1409-…` (my own BLIND run) | F1–F7 | yes |
| `00-04-scanner-…-1410-…` | F1–F5 | yes |
| `00-05-sot-keeper-…-1412-…` (inside `#1783`) | F1–F4 | yes |

**Board — 5 open at run start, 4 after the merge.** `[MEASURED]` `gh pr list --state open --json
number,title,headRefName,mergeStateStatus,isDraft,labels,createdAt,author,files` (assign-then-count,
never `@(ConvertFrom-Json …).Count` — §9.4):

| PR | state | labels | diff | classification |
|---|---|---|---|---|
| `#1783` | CLEAN, 10/0/0 green | none | `sot/02` + `sot/04` + 1 breadcrumb under `docs/` | **05's doc-reconcile lane** — MERGED this run |
| `#1777` | CLEAN, 15/0/0 green | none | `scripts/pipeline/sweep-breadcrumbs.ps1` | **MARCO'S** |
| `#1775` | BLOCKED, 13/2/0 | `do-not-merge` | `apps/api/**`, `package.json`, `scripts/rates/**` | **MARCO'S**, label absolute |
| `#1774` | BLOCKED, 13/2/0 | none | `.github/workflows/ci.yml`, `docs/qa/**`, `scripts/pipeline/**` | **MARCO'S** |
| `#1767` | BLOCKED, 13/2/0 | `do-not-merge` | `apps/api/prisma/migrations/**` + 8 | **MARCO'S**, migration + label |

**RULE 2 probe, pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed` and
**never** the watcher clone (§9.5). `[MEASURED]` **2056** logs; newest `rev-1783-ready.md.log`
**14:31:21Z**, younger than the oldest open PR (`#1767`, `06:43:58Z`) — the age control that
separates the live directory from the 17-day-stale decoy. POSITIVE `marco.:true` → **620**
(written without a quote character, regex `.` matches it). NEGATIVE, freshly minted needle → **0**.

Per-PR over **prompt logs only** (`processed\pr-*.log`, excluding the `rev-*` review jobs, §9.5):
`#1783 → 0`, `#1777 → 0`, `#1775 → 0`, `#1774 → 0`, `#1767 → 0`; NEGATIVE control `PR #999999` → 0;
**POSITIVE controls on the same corpus and query form: `#1606 → 2`, `#1589 → 1`, `#1675 → 1`** —
so `NO LOG` here is a real absence, not a broken probe.

`NO LOG` is `[CANNOT MEASURE]` for lane on its own (the kill loop erases `opened PR #` lines), so it
was corroborated two ways. **(i) Daily clone log, found by NAME SHAPE then mtime** — never
constructed from a date, never the newest `*.log` outright (`supervisor.log` collides):
`2026-09-07.log`, mtime **15:15:10Z** (younger than every open PR's `createdAt`), POSITIVE control
`[merge]` → 7, NEGATIVE → 0; newest `opened PR #` line is **07:31:07Z for `#1769`**, whose 90-min
`tests-docs` window closed ≈09:01Z and which has merged. **No open waiting window — the waiter did
not have to go first.** **(ii) `.arming-log.txt`**, 65 lines, `git diff --numstat origin/main` on it
**EMPTY** (so the dev copy is not a superset — no append-only reapply case): newest arm
**`2026-09-07T07:20:53Z pr-triageholds-s2-…`**, which produced `#1769`. **Nothing has been armed
since 07:20Z**, so no watcher build can have opened any of the five. All five are second lane,
recorded `[NO LANE VERDICT — hand-classified]`.

**`#1783` before the merge.** `[MEASURED]` `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`,
`isDraft: false`, labels `[]`. Checks: `Approval receipt (CP-26)` **pass**, `PR gates — diff checks`
(CP-24 lives there) **pass**, `CodeQL` pass, `Pipeline — watcher + linter tests` pass, `Pipeline —
arm-prompt tests (Windows)` pass, both `Analyze` pass; the API/Web/e2e/data-model jobs `skipping` on
the changed-path filter. Its body **names its lane** in its first line, as §10.1 step 3 requires.

**Arming triage.** `[MEASURED]` `triage-holds.ps1`, exit 0, both its own controls PASS
(`GIT control: PASS`, `SPENT control: PASS`): **46 HOLDs — spent=1, gates-satisfied=17,
still-gated=28, unreadable=0**, armed `-ready.md` = **0**.

Every one of the 17 `ADMIT` prompts was then measured for `scope:`, `gate_allow:`, the RULE 4
marker union, and §10.6 overlap against the open PRs (directory entries matched as a **prefix**, any
overlap ≥1 treated as a CANDIDATE, never a verdict — the 2026-09-07T03:4xZ correction):

| finding | count |
|---|---|
| `ADMIT` prompts whose `scope:` is **entirely** tests-or-docs by `classifyPolicyFiles` | **0 of 17** |
| carry `gate_allow: migrations` | 4 (`pr-tr-s1-reminder-policy`, `pr-sor-s9a-register-api`, `pr-fv2-maintenance-usage-intervals`, `pr-company-manage-s1-permission-and-grant`) |
| carry a RULE 4 don't-arm marker | 1 (`pr-triage-holds-open-pr-duplicate-bucket`, `DO_NOT_ARM_CAPS`) |
| §10.6 overlap candidates against the 4 open PRs | 6 rows / 5 prompts (below) |

Overlaps, with the full-match ones named: `pr-brandtheme-s2-hex-ratchet` **4/4 vs `#1774`** ·
`pr-tipid-s2-write-the-ids-backfill-and-admin` **4/4 vs `#1775`** · `pr-tr-s1-reminder-policy`
**7/9 vs `#1767`** · then the low-precision ones a single shared file produces —
`pr-ci-gate-dead-queue-dir-reads` 1/2 vs `#1774`, `pr-fv2-maintenance-usage-intervals` 1/5 and
`pr-sor-s9a-register-api` 1/7 vs `#1767` (both on `schema.prisma`). Controls:
`isTestOrDocs('docs/pipeline/DOCTRINE.md')` → true, `isTestOrDocs('apps/api/src/x.ts')` → false.

🔴 **The scope instrument lied on its first run and its lie had exactly the dangerous polarity.**
`[MEASURED]` the first pass returned `scopeN = 0` for **all 17** prompts — from which the available
conclusion is *"no prompt overlaps any open PR, nothing is a duplicate, arm freely."* The cause is
DOCTRINE §9.3's family: the files are **CRLF**, and in a JavaScript regex `.` does not match `\r`,
so `(?:\s*-\s+.*\n)+` cannot match a single list item. `Select-String '^scope:'` over the same 46
files returns **46** (NEGATIVE control 0) — every prompt has the key. Normalising `\r\n` → `\n`
before parsing fixed it. **A zero from a scope parser must be treated as an instrument fault until a
positive control says otherwise**, which is why the script now prints
`!! SCOPE PARSE RETURNED ZERO for <slug>` rather than a silent 0.

## WHAT CHANGED

1. **`#1783` MERGED.** `[MEASURED]` `Assert-SmokedOrEscalate -PR 1783` → `True/True`, then
   `Merge-Pr -PR 1783` (the sanctioned primitives, dot-sourced from `pipeline-lib.ps1`; never a raw
   `gh pr merge`, never a hand `git merge`). Read back:
   `{"mergeCommit":{"oid":"2e4f6315…"},"mergedAt":"2026-09-07T15:19:42Z","number":1783,"state":"MERGED"}`.
   **No receipt was authored** — the `merge-approvals/` receipt belongs to the *supervised cloud
   lane* under Marco's 2026-09-07 ruling; this is the scheduled lane on the box, which never writes
   one. CP-26 was already green on the PR (`NEVER_ESCALATED`).
2. **Dev tree fast-forwarded** `f9815d11` → `2e4f6315`. Read-backs: `HEAD` = `origin/main`,
   `git diff --cached --name-status` **EMPTY**, `git diff --numstat` shows only
   `2 2 docs/pipeline/sweep-rotation.json` — Station 04's advance, which is item 4 below.
3. **Station 00's 14:09Z breadcrumb repaired** — the missing `WHAT I DID NOT DO` heading added ahead
   of its `HANDOVER` one, nothing else touched, written with node by **concatenation** (never a `String.replace`
   replacement string — §9.3). Byte delta asserted: `before 9813 → after 11371`, delta **1558**
   against `NEW.length` **1550**. ⚠️ **The 8-byte gap is not a spill**: `String.length` counts UTF-16
   code units, so two `§` (+1 byte each) and three `—` (+2 each) account for it exactly — DOCTRINE
   §9.3's own trap, met inside the assertion written to catch a spill. Read back:
   `check-breadcrumb.mjs --freshness` → `structure: 5 checked, 0 malformed`, **`CLEAN`, exit 0**.
4. **This PR carries**: the two untracked breadcrumbs (1409 repaired, 1410) straight into
   `docs/pr-prompts/archive/`; `git mv` of the three now-dispositioned root breadcrumbs (1108, 1315,
   1412) into `archive/`; `git mv` of the one SPENT prompt into `superseded/`; Station 04's advanced
   `docs/pipeline/sweep-rotation.json`; and **this breadcrumb**, written inside the PR worktree —
   cure 1 of the station doc's post-merge FF rule, so no loose copy of it is ever left in the dev tree.
5. **Armed nothing.** Seventh consecutive run at zero. Reasoning in F1.

Disposable worktree `C:\po-worktrees\board-20260907-1516` off `origin/main`, torn down at the end.
Scratch scripts, outside the repo in `C:\po-sup-fix-scripts\`: `00-arm-triage-20260907-1535.mjs`,
`00-fix-1409-breadcrumb.mjs`, `sweep-1508.txt`, `sweep-1530.txt`, `triage-1535.txt`,
`daily-copy-1520.log`.

## FINDINGS

### F1 — zero of seventeen gate-cleared prompts is tests-docs-only, so arming anything adds a PR only Marco can merge

`[MEASURED]` above: 17 `ADMIT`, **0** whose `scope:` is entirely inside `classifyPolicyFiles`'
three test-or-docs forms. The board already holds **four** open PRs and every one of them
hand-classifies as Marco's; three are RED and one (`#1777`) is CLEAN and green and still cannot
merge. Arming an eighteenth Marco-gated PR makes the queue longer, not shorter — the throughput
constraint this board has been measuring for a week.

Three of the seventeen are additionally measured §10.6 duplicates of PRs already open
(`pr-brandtheme-s2-hex-ratchet` 4/4 vs `#1774`, `pr-tipid-s2-…` 4/4 vs `#1775`,
`pr-tr-s1-reminder-policy` 7/9 vs `#1767`), four carry `gate_allow: migrations`, and one carries a
`DO NOT ARM` marker the linter still `ADMIT`s — the recorded "a prompt that says do-not-arm about
*another* prompt makes itself unarmable" shape, not a new defect.

**DISPOSITION: DEFERRED.** It becomes urgent the moment Marco clears the board: the seventeen are
gate-cleared and ready, and the constraint is downstream of arming, not at it. **Falsifying probe:**
re-run the ALL-TESTS-DOCS column; a single `*** YES ***` row is an arm this reasoning does not block.

### F2 — the `sot/02` "open right now" table rots in one board-day, and twelve breadcrumbs have now paid for it (05's FINDING 2, dispatched to me)

Station 05 refreshed it again today and dispatched the **loop** — not the drift — to Station 00 with
RULE 1 options. Its (a), the complete-and-additive one, is to fence the table in
`<!-- SOT02-INPR:BEGIN/END -->` markers and generate it with a `--check` in `pipeline-tests`, the
way `sot/04` already works. 05 cannot ship it: CP-24 hard-blocks mixing `scripts/` + `.github/` with
`sot/`, with no escape hatch.

`[MEASURED]` no prompt for it exists yet — `docs/pr-prompts/**` matching `*sot02*` or `*inpr*`
returns only unrelated files. So the dispatch currently has no home.

**DISPOSITION: DEFERRED — with the reason stated, because deferring this silently is how it reaches
a thirteenth run.** Writing the prompt is inside my lane (`docs/pr-prompts/` is `docs/`), but the
prompt it produces builds a `scripts/` + `.github/` change, i.e. exactly the eighteenth Marco-gated
PR F1 argues against opening today. The honest sequencing is: **stage it the moment the board has
room, and stage it before arming anything else**, because it is the only candidate that removes
recurring cost rather than adding a queue entry. **Falsifying probe:** the absence of a
`*sot02-inpr*` prompt in the queue — if one appears, this is discharged.

### F3 — Station 00's 14:09Z breadcrumb was malformed and would have reddened this very PR (04's F3)

Station 04 dispatched exactly this to 00 at 14:10Z, and it was right about the mechanism:
`check-breadcrumb.mjs` runs in CI under `pipeline-tests`, so sweeping the file up unfixed reds the
board PR on its own breadcrumb, and the red reads as a CI problem rather than a missing heading.

**DISPOSITION: ACTIONED.** Repaired as item 3 of WHAT CHANGED; validator now `CLEAN`, exit 0.
Nothing above the inserted heading was altered, and the insertion says on its face who added it and
why. **Falsifying probe:** `check-breadcrumb.mjs --freshness` — a non-zero exit means it did not land.

### F4 — `--freshness` still reads `(cadence 2h)` for Station 00 against an hourly cron, and 04 measured a THIRD home for that number

`[MEASURED]` this run: `00  last 2026-09-07T14:09:00Z  1.2h ago  (cadence 2h)  ok`. Station 04's F1
(14:10Z) measured the third home — `C:\Users\Marco\Claude\Scheduled\00-supervisor\SKILL.md:8`,
*"Cadence: every 2 hours"* — against `cronExpression: "5 * * * *"` from the MCP. The two homes named
by `STATION-CAPABILITIES.md` §6 were the table (fixed in `#1670`) and `check-breadcrumb.mjs`'s
`CADENCE` map (still `'00': 2`). The bootstrap is the layer §1 calls *"the one that governs a
scheduled run"*, and it is the opening user turn of every 00 run — so a run is told, first thing,
that it fires half as often as it does.

Both surviving homes are outside my merge lane: one is the scheduled-task layer (Marco's,
unversioned, no CI), one is `scripts/`. 04's option (a) — **store the cadence in neither, read it
from the MCP** — passes both halves of RULE 1 and is already written up in its breadcrumb.

**DISPOSITION: ESCALATED — already open, re-verified rather than re-filed.** It belongs to
`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`, which
04's measurement strengthens. **Falsifying probe:** `Select-String` the bootstrap for `Cadence`
against `cronExpression` from the MCP; agreement kills it.

### F5 — every slot since the missed 12:08Z occurrence has fired, and the detector still could not tell me otherwise

`[MEASURED]` 13:0x, 14:09 and 15:08 all fired (three consecutive), against the 12:08Z occurrence the
13:15Z run escalated as lost. Three clean slots do not refute an intermittent defect, and — per F4 —
`--freshness` would read `ok` straight through a missed hour anyway, so the absence of an alarm is
not evidence either.

**DISPOSITION: DEFERRED.** Marco's, folded into the same escalation as F4; no new evidence in either
direction, recorded so the next run does not re-derive it.

### F6 — blindness struck the 14:09Z occurrence and not the 15:08Z one, sixty minutes apart on one machine

`[MEASURED]` 14:09Z: `ToolSearch` for `desktop-commander` run first, twice, schema never loaded,
`CONNECT_TIMEOUT` after 30 s — genuine blindness under the PREFLIGHT test. 15:08Z (this run): pid
2740 first try. Station 04 recorded the tighter pair the same hour (14:09 blind / 14:10 sighted).
`STATION-CAPABILITIES.md` §2's *"intermittent, cause not known"* is confirmed again; the standing
escalation `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` holds it.

**DISPOSITION: ESCALATED — existing file, recurrence recorded.** Not re-filed: a second file for one
defect splits the evidence.

### F7 — `C:\po-vg` is now 79 hours old and still holds one uncommitted file (03's, and 05 flagged the age)

`[MEASURED]` sweep §2: `orphaned worktree … C:/po-vg 23c91ba9 [fix/no-rebase-while-checks-run]
dirty=1 files age=4757 min`. Project memory records 63 h; 05's 14:12Z breadcrumb recorded 78 h.
`git worktree remove` will refuse and `--force` would discard the file. Also `watcher clone:
branch=main dirty=6` (was 5 at 14:12Z).

**DISPOSITION: DISPATCHED → Station 03**, folded into the open dispatch rather than re-raised. The
only new fact is the age, and it is moving toward the file being lost to a routine prune. **I did
not touch it** — machine state is 03's lane and the file is unrecoverable if a prune wins.

### F8 — `pollForBehindPrs` and the `sot/04` staleness both stand unchanged; recorded so they are not re-derived

`[MEASURED]` 00's 14:09Z F4 measured `pollForBehindPrs` firing on all four open PRs within four
minutes of the `#1760` merge — the third confirmation of an already-escalated behaviour. 05's
FINDING 1 (`sot/04` two days stale, `--check` structurally unable to catch it) and FINDING 3 (05's
brief still orders a `docs/data-model/sweeps/<date>.md` the contract replaced) are ACTIONED and
DEFERRED respectively in 05's own report and need nothing from me. 04's F2 (`05-sot-keeper.md:245`
citing a rotted `CLAUDE.md:19`) is dispatched to 05 and is one clause in its next doc-reconcile.
04's F4 (`.gitignore:107-111` in four live bootstraps) and F5 (the drift sweep otherwise clean) are
already open with Marco and deferred respectively.

**DISPOSITION: DEFERRED.** Every one of them is either already escalated, in another station's lane,
or actioned by its author. Listed here so this collect closes them rather than leaving them to be
re-found; nothing in this block asks anything of the next run.

### F9 — `check-breadcrumb.mjs` rejects a breadcrumb that merely QUOTES one of its own section headings, and it fired on the run repairing a missing one

`[MEASURED]` this run, on the first draft of this file. `checkOne` orders the sections with
`text.indexOf(s)` over the whole document — **first textual occurrence, not a heading at line
start** (anchor: the `for (const s of SECTIONS)` loop, `if (i < last) fails.push('section out of
order: …')`). WHAT CHANGED item 3 above described repairing the 14:09Z breadcrumb and named the
heading it added, in backticks, mid-sentence. That put the string ahead of `FINDINGS`, so the
validator reported `section out of order`, exit **1** — a correct reading of the wrong quantity
(§7). Removing the two `#` characters from the quoted heading, changing nothing structural, took it
to `CLEAN`, exit 0.

The polarity is the awkward one: the message names a section that IS present and IS in the right
place, so the obvious response is to move a heading that does not need moving. This is the same
family as §9.6's *"never run a probe against the document that describes it"* — here the document
being scanned is the report, and the needle is the report's own vocabulary. It cost this run one
edit and no work; it would cost more on a report whose author reached for the heading name in a
finding rather than in a passing clause.

**S4** — cosmetic, never data-affecting, and it fails **SAFE**: the wrong answer is a REJECT, so no
malformed breadcrumb can slip through on it. A `scripts/` fix (match `^## …` per line, or slice the
front matter) is outside my merge lane and would open an eighteenth Marco-gated PR for a
cosmetic defect, which F1 argues against today.

**DISPOSITION: DEFERRED**, with the workaround recorded here so the next station that meets the
message does not go looking for a misplaced heading: **do not write a section heading with its `##`
in prose.** **Falsifying probe:** put the literal `## GROUND` (with hashes) into a breadcrumb's
WHAT I MEASURED section and re-run the validator — a `CLEAN` means this has been fixed.

## WHAT I DID NOT DO

- **Did not merge `#1777`, `#1775`, `#1774` or `#1767`.** All four hand-classify as **MARCO'S** —
  `#1777` `scripts/`, `#1774` `.github/` + `scripts/`, `#1775` `apps/api` + `package.json` +
  `scripts/`, `#1767` a `migrations/` path (which `classifyPolicyFiles` refuses on its own clause).
  `#1775` and `#1767` additionally carry `do-not-merge`, which **only Marco removes**.
- **Did not chase the three reds, did not rebase for them, did not push to their branches, and did
  not author a receipt for any of them.** Standing instruction from the 13:3xZ run; nothing measured
  today changes it.
- **Did not remove or add a label anywhere.**
- **Armed nothing** — not one of the 17 gate-cleared prompts, and specifically not
  `pr-tr-s1-reminder-policy` (migration + 7/9 duplicate of `#1767`),
  `pr-brandtheme-s2-hex-ratchet` (4/4 duplicate of `#1774`), `pr-tipid-s2-…` (4/4 duplicate of
  `#1775`), or `pr-triage-holds-open-pr-duplicate-bucket` (`DO NOT ARM` marker).
- **Did not write the `sot/02` in-PR generator prompt** (F2) — deferred deliberately and with the
  sequencing stated, not silently.
- **Did not edit `docs/pipeline/stations/05-sot-keeper.md`** for 04's F2. 05's document, 05's lane.
- **Did not touch `C:\po-vg`, the watcher clone's six dirty files, the eleven dev-tree stashes, or
  any worktree but my own disposable one.** Machine state is Station 03's.
- **Did not sweep the other untracked files in the dev tree** — `docs/pr-reviews/pr-*.md` (55 review
  artifacts), `docs/pr-prompts/.queue-sync-ledger.txt`, `queue-watch-state.md`, the two `*-LOOPING.md`
  files, `Claude Design/docs/index.html`. None is a breadcrumb; sweeping them is not this run's job
  and the review artifacts are deliberately preserved.
- **Did not run `git` from the VM against the Windows `.git`.** The guard was installed first and its
  last line is quoted under GROUND; every git call this run went through Desktop Commander.
- **Did not `git checkout .`, `reset --hard`, `stash pop` or `git clean` anywhere** — the
  fast-forward was a plain `merge --ff-only` onto a tree whose `--cached` was EMPTY.
- **Azure / Entra / SharePoint: not touched, not read, not reasoned about.** No production data, no
  migration, no secret, no permission, no `az`, no `Connect-MgGraph`.
