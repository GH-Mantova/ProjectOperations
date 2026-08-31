# Station 00 — Supervisor | 2026-08-30T12:08:19Z–2026-08-30T12:5xZ

## GROUND

```
UTC            2026-08-30T12:08:19Z
origin/main    9a447e64              (git fetch --prune origin, then rev-parse origin/main)
dev tree       main @ 9a447e64       C:\ProjectOperations2   (CONVERGED, 0 ahead / 0 behind)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE — full authority, not read-only-degraded.

**SIGHTED run.** `start_process` shell `powershell.exe` succeeded (PID 36540). Desktop Commander
present. This was **not** a blind run.

Binding docs read in full this run: `00-supervisor.md` (897 lines), `DOCTRINE.md` (479 lines),
`STATION-CAPABILITIES.md` (207 lines). The dev tree is converged with `origin/main` at the same SHA,
so reading them from disk was equivalent to `git show origin/main:<path>`.

## WHAT I MEASURED

**Board gate.** `status-sweep.ps1` → `SAFE TO ACT: no board mutation in progress, no recent remote
activity`, `SWEEP COMPLETE 2026-08-30 12:08:43Z`. [MEASURED]

**Board.** `gh pr list --state open` → `[]`. **ZERO open PRs.** No DIRTY PR, therefore no frozen CI,
therefore the board is not blocked by a conflict (Q1/Q2 of the answer sheet). [MEASURED]

**Arming state.** `*-ready.md` at depth 1 = **0**. `*-HOLD.md` at depth 1 = **59**. Counted myself
with `Get-ChildItem`, not quoted from a note (Q3). [MEASURED]

**Watcher.** `restart-watcher-if-wedged.ps1` (the only sanctioned liveness probe) →
`watcher process: ALIVE (pid 26364)`, `armed prompts waiting: 0`, `restart churn: 0 cycle(s) in
20 min`, **`VERDICT: OK — nothing armed and the watcher is alive. An idle watcher is correct, not
wedged.`** [MEASURED]

🔴 **OAuth token — SIXTEENTH consecutive reading, still dead.** `C:\Users\Marco\.claude\
.credentials.json`: mtime **`2026-08-28T16:13:26.909Z` (UNCHANGED across all sixteen readings)`,
`expiresAt` = `1787933615984` = **`2026-08-28T16:13:35.984Z`**. At 12:08Z that is **expired
43.9 hours**. The 9.075-second lead between the last write and the expiry is unchanged: the file
STORED a credential that was already 9 s from death, so the failure is in the refresh RESPONSE, not
in a refresher that stopped running. **The arming block stands. Nothing was armed this run.**
[MEASURED — read directly on the box; a blind run cannot reach this path and must inherit the block]

**Breadcrumb freshness.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN,
exit 0**. 121 checked, 0 malformed, 9 skipped as pre-contract. No station SILENT:
00 2.0h/2 · 03 13.1h/24 · 04 2.0h/4 · 05 22.0h/24. [MEASURED]

**Collected this run: ONE breadcrumb**, untracked in the dev tree —
`00-04-scanner-2026-08-30-1010-repo-hygiene.md` (19270 bytes, five findings F1–F5). Also left
modified by that run: `docs/pipeline/sweep-rotation.json`. Both are in this PR. Nothing else was
uncollected: the next-newest breadcrumbs are my own 10:09Z run and 04's 06:11Z, both already
landed on main. [MEASURED]

**F1 re-verified before acting on it** (the re-read rule). `scripts/pipeline/triage-holds.ps1`, all
29 lines read: its only HOLD logic was `foreach ($n in 545, 548) { gh pr view $n ... }`. Zero
references to `docs/pr-prompts`, zero globs, zero premise evaluation, and no path that can exit
non-zero. 04's finding is exact. [MEASURED]

🔴 **`lint-prompt.mjs` MUTATES — but only under `--dequeue`.** Before delegating to it I checked:
`renameSync(file, file.replace(/-ready\.md$/, ".md") + ".stale-premise-already-satisfied")` at
`:1440` is guarded by `if (dequeue)`. On a `-HOLD.md` the `-ready.md` replace is a no-op on the
suffix but the rename would still fire, so a "read-only triage" that passed `--dequeue` would
silently rename spent HOLDs. The new script never passes it, and says so in its header. [MEASURED]

**The rewritten triage-holds.ps1, run once as its own calibration:** 59 HOLDs, **spent=0 ·
gates-satisfied=29 · still-gated=30 · unreadable=0**, `calibrated: 2 distinct verdicts observed`.
Two independent cross-checks: the count 29+30 matches the 59 counted by `Get-ChildItem`, and it
matches the prior census (30 ADMIT / 29 REJECT) shifted by exactly one — #1400 put
`<!-- watcher: do-not-arm -->` on `pr-dns-s5-checker-flip-to-fail-HOLD`, moving that one prompt
from ADMIT to REJECT. [MEASURED]

**Instrument note, minor:** the line number in a `HUMAN_GATE_PRESENT` message is **body-relative,
not file-relative** — `stripCodeContext()` removes the front matter before scanning, so a marker
physically on line 15 is reported as "line 2". Recorded so the next reader does not go looking at
the wrong line; not filed as a finding. [MEASURED]

**F4's safety precondition, measured before ratifying the rule.** `check-breadcrumb.mjs` builds its
tracked set with `git ls-tree -r --name-only origin/main -- docs/pr-prompts` and then maps every
path to its **basename** before matching `NAME_RE`. A breadcrumb moved into
`docs/pr-prompts/archive/` therefore **still counts for `--freshness`** and can never make a station
read SILENT. Structural re-validation stops for archived files (`readdirSync` is depth-1), which is
correct — they were validated when they landed. [MEASURED]

**`pr-smoke-share-worker-tokens`'s prose chain gate is satisfied:**
`git show origin/main:scripts/pipeline/smoke-pr.ps1 | Select-String AUTH_THROTTLE_LIMIT` → **3
matches**, and the prompt lints **ADMIT (exit 0)** after re-suffixing. It is a candidate, not an
instruction — and the OAuth block means nothing is armed regardless. [MEASURED]

## WHAT CHANGED

Every change is in ONE PR off `origin/main` in a disposable worktree (`C:\po-worktrees\sup-1209`),
never the shared dev tree. `git diff --cached --name-status` in the dev tree was **empty at the
start and at the end** of this run.

1. **Collected** `docs/pr-prompts/00-04-scanner-2026-08-30-1010-repo-hygiene.md` and the modified
   `docs/pipeline/sweep-rotation.json` from the dev tree, copied as raw Buffers in node
   (DOCTRINE §9.3 — never `>` or `Out-File`), `Buffer.compare` read-back = 0 on both.
2. **`scripts/pipeline/triage-holds.ps1` rewritten** (+120 / −22). It now enumerates every depth-1
   `*-HOLD.md` and classifies each by `lint-prompt.mjs`'s EXIT CODE, and refuses to be believed
   when it cannot: if every HOLD lands in one bucket it prints `!!! SUSPECT` and names the two
   things to prove first. **Read back:** run against the live queue it returned a mixed, calibrated
   result (above) — the old script could not return anything but exit 0.
3. **Both false citations corrected** — `docs/pipeline/SCRIPT-REGISTRY.md` (the row) and
   `docs/pipeline/stations/04-scanner.md` (the instrument bullet). **Read back:**
   `node scripts/pipeline/lint-station.mjs` → **`ADMIT: all 7 docs clean`, exit 0** (the canonical
   blocks are untouched; the edits are outside them, guarded in the edit script by a line-index
   assertion).
4. **`docs/pipeline/stations/00-supervisor.md`** — the breadcrumb-archive rule ratified as a bullet
   in AUTHORITY, next to COLLECT (+9 lines, outside the canonical block).
5. **Four queue-root renames** (`git mv`, all tracked):
   - `pr-permission-role-reconciler.md` → `…-HOLD.md`, **plus the literal
     `<!-- watcher: do-not-arm -->` marker** after its front matter, because its gate was PROSE
     ("Do NOT rename to `-ready` until Marco … has signed off") and a prose gate is invisible to
     every instrument we have. **Read back:** it now lints **`REJECT [HUMAN_GATE_PRESENT]`,
     exit 1**, where before the rename no instrument saw it at all.
   - `pr-smoke-share-worker-tokens.md` → `…-HOLD.md`. **Read back:** lints ADMIT, exit 0.
   - `pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md` → `superseded/`
   - `pr-user-default-dashboard-ui-RETIRED-premise-cannot-die-2026-08-18.md` → `superseded/`
6. This breadcrumb.

**Read back, whole PR:** `node scripts/pipeline/check-breadcrumb.mjs` → **CLEAN, exit 0**
(121 checked, 0 malformed). `node scripts/pipeline/lint-station.mjs` → **ADMIT, exit 0**.
`git diff --numstat` totals 136/26 across 7 files — no runaway line-ending rewrite.

**Nothing was armed.** `*-ready.md` at depth 1 was 0 before and 0 after. No merge of a
watcher-routed PR. No `do-not-merge` label removed. No `/sot/` edit. No `git` in the watcher clone.

## FINDINGS

Findings F1–F5 are Station 04's, from the breadcrumb collected this run. Each carries MY
disposition, which is the only channel that closes them.

### F1 (04) — `triage-holds.ps1` claimed to prove which HOLDs are satisfied and examined none of them

Confirmed verbatim before acting (see WHAT I MEASURED). 04's RULE-1 option **(A)** — make the script
do what its name says — was the complete-and-additive one, and it is what I built, with one
deliberate change to its shape: **it delegates to `lint-prompt.mjs` rather than evaluating gates
itself.** A second gate engine that can disagree with the one the watcher obeys is a new instrument
that lies, which is the defect being fixed, not a cure for it. (A) subsumed (B), so both citations
now describe real behaviour rather than being softened to match a stub.

**ACTIONED.** Script rewritten and run — 29 gates-satisfied / 30 still-gated / 0 spent, calibrated
on two distinct verdicts. Both citations corrected; `lint-station.mjs` ADMITs all 7 docs.

### F2 (04) — the watcher clone is 25 commits behind `origin/main`, and nobody may fast-forward it

04 added the measurement this question was missing: 25 behind / 0 ahead, `merge-base --is-ancestor`
exit 0 (a clean ff is available), and `git diff --name-only 181817aa..62fd27f1 -- scripts/pr-watcher`
is **empty** — the watcher ENGINE is unchanged, so this is not "the watcher runs stale logic". The
cost is narrower and still real: agent runs execute inside that clone, so the first prompt to run
after the queue unfreezes cuts its branch 25 commits back.

Station 00 is barred from git in the watcher repo absolutely (station doc, DOCTRINE §4, and the
mandate's *"never merge in the watcher repo"*). Station 03 is report-only. Station 04 is read-only.
**Three stations can see it; none may fix it.** RULE 1, complete-and-additive first:
**(C)** a guarded `ff-watcher-clone.ps1` (asserts `0 ahead`, `--ff-only`, watcher stopped, relaunch)
plus a narrow grant of it to Station 03 — passes both halves, and every future drift is handled by
the same instrument · **(A)** Marco does it by hand now — fixes today, fails the future half, the
drift returns in days · **(B)** leave it — fails both, and it is the state we are in.

**ESCALATED** — unchanged question, better evidence. It is not urgent while the queue is frozen by
the OAuth block; it must be settled **before** the queue is unfrozen.

### F3 (04) — 21 of 22 non-`main` remote branches are dead, and the obvious diagnosis is wrong

04 checked the two things a naive report would have got wrong and both refuted a finding:
`delete_branch_on_merge = True` (the setting deletes on *merge*, never on *close*, so 20
closed-unmerged branches are it working), and the "~900 commits at risk" numbers are an artefact of
branches with **no merge-base** against current `main`.

**DEFERRED** — 04's disposition accepted unchanged. Nothing is broken and nothing is at risk;
deleting closed-unmerged branches discards work. It becomes urgent only if someone proposes a branch
cleanup — at which point the calibration above must be applied before any number is trusted.

### F4 (04) — the queue root is 70% breadcrumbs, growing ~20/day, and `archive/` already exists unused

**ACTIONED, in the half that stops the growth.** The rule is now in `00-supervisor.md` next to
COLLECT: once every finding in a breadcrumb carries a disposition, `git mv` it to
`docs/pr-prompts/archive/` in the same board PR. I measured the precondition first rather than
ratifying a rule that could blind `--freshness` — `check-breadcrumb.mjs` matches on the BASENAME, so
an archived breadcrumb still counts and no station can be made to read SILENT by archiving.

The **backlog** — 159 breadcrumbs already in the root — is deliberately NOT in this PR. A 159-file
rename mixed with a script rewrite and four prompt renames is a diff nobody can review, and the
first application of a brand-new convention is exactly the one that should be separable. It is the
first task of the next run, as its own PR.

### F5 (04) — four prompts tracked in the queue root that no instrument can see

**ACTIONED.** I read both suffix-less prompts before deciding, as 04 asked. Both are live, coherent
work, not litter: `pr-permission-role-reconciler` is the durable follow-up to #876's one-off
migration (declarative role→permission map + additive boot-time reconciler), and
`pr-smoke-share-worker-tokens` is the structural cure for the smoke harness's per-worker logins.
Neither could execute (`*-ready.md` is the only glob), neither could be audited, and both had sat
27 days. Re-suffixed to `-HOLD.md`, which makes them visible to every census without arming
anything; the other two, dead by their own filenames, went to `superseded/`.

The reconciler additionally got `<!-- watcher: do-not-arm -->`, because making a prompt visible to
the arm-order census while its only gate is PROSE is how #1400's predecessor burned an arm. It now
REJECTs at `lint-prompt.mjs:728`, before its premise is ever evaluated.

### F6 (mine) — the OAuth credential has been dead for 43.9 hours and the arming lane is frozen

Sixteenth consecutive reading, mtime unchanged throughout. Every armed prompt would burn on a 401
without producing work, which is why nothing has been armed for two days and why doc/queue
corrections keep being hand-landed instead (#1394, #1400, #1401, and this PR). RULE 1:
**(C)** re-authenticate **and** add a pre-arm guard that refuses to arm while the token is expired —
passes both halves, and no future run can burn a prompt on a dead token · **(A)** re-authenticate
only — fixes today, fails the future half · **(B)** keep hand-landing — fails both; it works for
docs and cannot deliver a single line of application code.

**ESCALATED** — only Marco can re-authenticate. The guard in (C) is mine to build once he says yes.

### F7 (mine) — Station 06 has no cadence key at all, so anything dispatched to it parks silently

`CADENCE` in `check-breadcrumb.mjs` has no `'06'` key — not `null` like `'02'` (which prints
*"dispatch-only — no cadence to miss"*), simply **absent**. 06 can therefore never read `ok`, never
read `SILENT`, and never appears in `--freshness` in any form: there is no instrument that can
notice a dispatch to 06 parking forever. Measured again this run against the current file.

The obvious fix is a trap and I am recording why: `'06': <number>` **without a scheduled task** makes
`--freshness` exit 2 on every station's preflight forever (`SILENT → process.exit(2)`), and
`'06': null` prints a reassurance that is TRUE of 02 and FALSE of 06. **The cadence key and the
scheduled task are inseparable halves of one fix, and creating the task is Marco's box.**

**ESCALATED.** (A) give 06 a schedule AND the cadence key together — the only option that passes
both halves · (B) 00 actions 06-bound items itself — fixes today, fails the future half and quietly
widens 00's lane · (C) leave it — fails both, and it is why a defect named in a breadcrumb FILENAME
on 08-26 was still live three days later.

## WHAT I DID NOT DO

**Armed nothing.** `-ready.md` at depth 1 = 0 before and after. The OAuth block stands (F6) and
`pr-smoke-share-worker-tokens-HOLD` lints ADMIT — that is precisely the situation in which arming
burns a prompt for nothing. ADMIT is a candidate, never an instruction.

**Did not move the 159 archived-eligible breadcrumbs** (F4). Reviewability, and a new convention
should be exercised in a diff where it is the only thing happening. First task of the next run.

**Did not fast-forward the watcher clone** (F2) — barred absolutely, and whose authority it is is
the escalation.

**Did not touch the `sot/` tree, the watcher clone's git, Azure/Entra/SharePoint, or production
data.** No `git checkout .` / `reset --hard` / `stash pop` / `clean` anywhere.

**Did not re-lint the board beyond the single calibration run** of the new triage script, which is
the instrument proof rather than a census.

**Did not write to `docs/qa/qa-findings.md`** — it is gitignored at `.gitignore:107` and swallowed a
real finding for nine days. Everything above is in this tracked-path breadcrumb only.

**Did not delete the two suffix-less prompts.** They describe real, unbuilt work; deleting them is
the 2026-07-23 loss shape. `-HOLD` makes them visible without arming them.

---

**Validation.** `node scripts/pipeline/check-breadcrumb.mjs` → **CLEAN, exit 0**.
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**, no station SILENT.
`node scripts/pipeline/lint-station.mjs` → **ADMIT: all 7 docs clean, exit 0**. breadcrumb-clean.

True at `origin/main` **9a447e64**, 2026-08-30T12:08:19Z–12:5xZ.
