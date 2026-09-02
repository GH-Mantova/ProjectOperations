# Station 00 — Supervisor | 2026-09-02T00:08Z–00:25Z

## GROUND

```
UTC            2026-09-02T00:08:46Z
origin/main    ef664f15  →  7324b899   (advanced DURING this run; see F1)
dev tree       main @ 6583a220         C:\ProjectOperations2
doc version    1
bootstrap      1
```

Bootstrap and station doc agree — no read-only downgrade. **SIGHTED run:** a shell was obtained on
the Windows host at 00:08:22Z (`LAPTOP-E6NHU4E4`). All three binding documents were read in full and
verified byte-identical to `origin/main` (`git diff origin/main -- <path>` empty for each).

## WHAT I MEASURED

- **[MEASURED] Locks: NONE.** No `index.lock` / `MERGE_HEAD` / `REBASE_HEAD` / `CHERRY_PICK_HEAD` in
  either `C:\ProjectOperations2\.git` or `C:\po-watcher\ProjectOperations\.git`.
  `(Get-CimInstance Win32_Process -Filter "Name='git.exe'").Count` = **0**.
- **[MEASURED] Watcher HEALTHY and supervised three deep.** Parent chain walked from the node:
  `30600 watcher-launcher-singlelane.ps1` → `34332 start-watcher.ps1` → `28400 node index.mjs`.
  Identical to the 20:09Z reading — no relaunch churn. `restart-watcher-if-wedged.ps1` →
  `VERDICT: OK`, `armed prompts waiting: 0`, `restart churn: 0 cycle(s) in 20 min`.
- **[MEASURED] Collect queue: 5 breadcrumbs, 1 malformed, 4 untracked.** `check-breadcrumb.mjs`
  exit 1 on the blind 00's 22:10Z file (all five contract sections missing). No station SILENT
  (00 2.0h / 03 1.1h / 04 2.0h / 05 10.0h, all ok).
- **[MEASURED] Board: 2 open PRs at 00:10Z** — `#1500` CLEAN, `#1483` BLOCKED. **1 open at 00:11Z.**
- **[MEASURED] RULE-2 probe, positive control 603** (`-Pattern 'marco.:true'`, was 592 on 08-31).
  Both open PRs carry a LIVE `marco:true` verdict.
- **[MEASURED] The blind run's breadcrumb was NOT corrupt.** `node` read: 4806 bytes, **0 × U+FFFD,
  0 × `â€`**. The PowerShell display showed `�?"` — DOCTRINE §9.3 false mojibake, in the reader.
  Bytes checked before anything was called corrupt.

## WHAT CHANGED

1. **Repaired the malformed breadcrumb** (`00-00-supervisor-…-2210-blind-third-recurrence…`).
   Remapped `## 1. Preflight / 2. Findings / 3. Dispositions / 4. Actions taken` onto the five
   contract sections. **All prose is the blind run's own, verbatim — nothing retired, nothing
   shaved.** Read back: `check-breadcrumb.mjs` → `structure: 5 checked, 0 malformed` → **CLEAN,
   exit 0**.
2. **Discharged 31 dead escalation files.** 30 × `WATCHER-CRASH-LOOP-2026-09-01-*` + 1 ×
   `WATCHER-CHURN-*`, all from the single 09:55–12:15Z incident, **moved (not deleted)** to
   `needs-marco/discharged/` with a discharge note naming the 12:25:08Z relaunch as the resolution.
   Read back: `WATCHER-*` remaining in `needs-marco/` = **0**; live `needs-marco/` files **37 → 6**.
   That removes 31 uncheckable `[FILE]` lines from every future sweep §5.
3. **Cleared the two orphan worktree registrations** (Station 04 F1 / Station 03 F3).
   `git worktree unlock` + `remove --force` on both `/sessions/rcw-…` Linux paths, then `prune`.
   Read back: `git worktree list` = 2 real entries; `.git\worktrees\` = only `s2-e2e`; **both
   0-byte stale `index.lock` files went with their admin dirs**; branches `stage/brandtheme-s1-s2`
   and `-v2` both **survive**. Nothing on disk was lost — those working trees never existed on this
   host (`Test-Path` → False, measured by 04).

**Nothing was armed. Nothing was merged. No label was added or removed.**

## FINDINGS

### F1 — 🔴🔴 NINTH UNATTRIBUTABLE MERGE — and the first one observed INSIDE a station's own run window, overriding a LIVE `marco:true`. **ESCALATED**

**[MEASURED]** At **00:10:0xZ** I read the open board: `#1500 CLEAN, open`. At **00:11:41Z** I read
it again: `state=MERGED, mergedAt=2026-09-02T00:10:06Z, mergedBy=GH-Mantova, autoMergeRequest=null,
labels=[]`. `origin/main` moved `ef664f15` → **`7324b899`** underneath me.

**I did not merge it.** This run executed no mutation before 00:14Z; every call up to that point was
a read, and the three mutations I did make (above) are all local filesystem/worktree operations. The
merge is therefore definitively a **second lane**, and this is the first occurrence any station has
watched happen live rather than reconstructed afterwards.

**It merged a PR carrying a live RULE-2 verdict.** `processed/pr-station-docs-…-ready.md.log` holds
`[watcher] merge result for PR #1500: {"ok":false,"marco":true,"reason":"timeout waiting for green
checks + MERGE verdict"}`. RULE 2 is not cleared by green, by CLEAN, by an empty label set, or by a
provably-weak routing reason — and it was overridden anyway.

**No harm landed.** #1500 was docs-only (`03-machine-minder.md`, `04-scanner.md`), all checks green,
and its content is the correction *I* staged. `docs/decisions/merge-approvals/` still contains only
`README.md` — the receipt convention has now never been used across nine releases.

This folds into open escalation **#20**. It does not change its two halves; it raises their price.
🔴 **No agent may ever author a `merge-approvals/<N>.md`** — an agent-written receipt turns the only
working instrument into a rubber stamp.

### F2 — 🔴 DOCTRINE §10.3 NAMES THE WRONG CAUSE for the dead tests-docs lane. Refuted by direct experiment. **ESCALATED**

§10.3 asserts the lane has not fired since #1301 *"not because the gate is blocked: because docs work
is hand-landed … so it never reaches the gate."* I armed `pr-station-docs-wrong-wrapper-and-false-
gitignore-claim` at 20:15:47Z **specifically to test that.** The work reached the gate. The gate
still did not fire. **The stated cause is REFUTED; here is the measured one:**

| | [MEASURED] |
|---|---|
| `#1500` opened | 2026-09-01T20:18:43Z |
| Its first CI run **created** | 2026-09-01T23:51:20Z — **212.6 min later**, `run_attempt=1` (NOT a re-run) |
| Watcher merge window | `MERGE_TIMEOUT_MS` = **90 min** (`index.mjs:129-130`), expired ≈21:48Z |
| Gap between timeout and CI existing | **2 h 03 min** |

**Positive controls, same window:** `#1502` gap 0.0 min · `#1501` gap 0.0 min (opened **8 seconds
after** #1500) · `#1499` 0.0 · `#1498` 0.0 · `#1497` 0.0. So this is not a GitHub-wide outage and not
a repo-wide condition — **#1500 alone waited 212 minutes for its first workflow to be created.**

**The mechanism.** `index.mjs:1753-1757` requires `checks.length > 0 && checks.every(SUCCESS|NEUTRAL|
SKIPPED)` before it will enable auto-merge. With **zero** checks in existence, `allGreen` is false for
the entire 90-minute window, so the lane cannot arm auto-merge, falls out of the loop at `:1774`, and
records `marco: true` at `:1776`.

🔴 **The consequence is the dangerous part: a TIMEOUT is written in the byte-identical format to a
genuine policy routing.** A docs-only PR that the tests-docs policy would have merged with no human
becomes permanently human-gated — and RULE 2 correctly forbids any station from clearing it. The lane
designed to *remove* work from Marco silently *creates* it, and every station that reads the verdict
afterwards sees only `"marco":true`.

**RULE 1 options for Marco — complete-and-additive first:**

1. **Distinguish the two outcomes in the verdict.** Emit a separate `reason`/flag for
   *"timed out with no checks ever created"* vs *"policy says Marco"*, and have the watcher re-check
   such a PR on a later pass instead of abandoning it. Solves it **immediately** (this PR would have
   merged itself) and **permanently** (any future CI-latency spike degrades to a retry, not a false
   human gate), and it touches **no queue data and no existing verdict semantics** — RULE 2 keeps
   working exactly as it does today for real routings. **Passes both halves.**
2. Raise `PR_WATCHER_MERGE_TIMEOUT_MIN` above 212. Fails the **future** half — it widens a window
   without removing the conflation, and a 213-minute latency reproduces it.
3. Leave it and hand-merge such PRs. Fails **both** halves — it is the status quo that has now
   produced nine unattributable merges, and it asks a human to override RULE 2 by hand, which is
   precisely the habit that made the label removals invisible.

⚠️ **Why the 212-minute delay itself happened is [CANNOT MEASURE] from here** — `run_attempt=1`
rules out a re-run, and the four sibling PRs rule out an outage. It needs GitHub-side workflow
queue/concurrency data I do not have. That is a **second, separate** question from the conflation
above, and option 1 makes the pipeline safe regardless of its answer.

### F3 — Escalation #17's own co-failure diagnostic is REFUTED this run. **ESCALATED (narrows #17)**

The blind 22:10Z run proposed a free diagnostic: *"when a station reports blindness, check whether
`Prisma-Local` failed in the same run — if they always fall together it is one fix."*
**[MEASURED] this run: `Prisma-Local` failed `CONNECTION_CLOSED` and `desktop-commander` connected
normally.** They do **not** always fall together. The "one local-stdio spawn fault" hypothesis is
weakened; `Prisma-Local` failing is **not** a predictor of Station 00 blindness. Marco's A/B/C at
`needs-marco/station-00-blindness-…-2026-09-01.md` are unchanged and still his — but option (A)
(raise timeout + pre-warm) no longer gets support from the co-failure argument.
**Today's blindness count stands at 3 of 4 cadences (10:0x, 16:0x, 22:0x); this 00:0x run is SIGHTED.**

### F4 — Station 03 F1: the watchdog can still kill a healthy idle node. **DISPATCHED → deferred to a prompt, NOT armed this run**

03's analysis is sound and its option 1 (treat stale `.queue-state.json` as *unknown*, never as
`runnable>0`) is the complete-and-additive one. **But the edit is `scripts/pr-watcher/supervise-
watcher.ps1` — outside `tests/|docs/`, so `classifyPolicyFiles` routes it to Marco**, on a board
where that queue is already saturated and where F2 shows the docs lane itself is broken. The
condition is **latent**: armed=0 and `.queue-state.json` 0 min old, both measured this run, and all
three of its preconditions must hold to fire. **Not armed this run** — arming it would add a tenth
Marco-routed PR while F1/F2 are unresolved. It is the first thing to arm once F2 has an answer.

### F5 — Station 06 F3: `pr-cardui-s2-wbs-table-shell-HOLD.md` is a live duplicate. **ACTIONED (by not acting) + carried**

06's finding is correct and I obeyed it: **`pr-cardui-s2-*` was NOT armed.** #1483 still carries the
work. Its general form — 06's F4, *any armed prompt whose PR does not delete it stays armable
forever* — remains **DEFERRED**, unstaged, and is a real queue defect worth its own prompt.

### F6 — `#1483` unchanged and still barred. **CARRIED**

**[MEASURED]** `mergeStateStatus=UNKNOWN`, `labels=[]`, head `96201e09`, `tendering-e2e = FAILURE`.
Live verdict `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled
do-not-merge"}` — **the label is gone again while the verdict stands**, the seventh occurrence, still
escalation #20's first half. **[MEASURED, NEW]** a fourth worktree appeared since 04's 22:10Z reading:
`C:/po-work/s2-e2e` @ `96201e09` = **#1483's exact head** — someone is actively working its e2e.
**I did not touch it**, and I pruned only the two Linux-path orphans around it.

### F7 — Station 03 F4 / Station 04 F2: the clone's stash pile is 64 and accelerating. **DEFERRED**

DOCTRINE §9.2's named closed loop. 49-day average ~1.3/day; **last 24 h ran at 9/day**, three minted
inside three minutes of the crash loop. Nothing is lost — the clone's tree is reconstructable from
`main`. `git stash drop`, **never `pop`**. Not urgent; it becomes urgent if it starts costing disk or
if a restart storm recurs. **Re-measure every hygiene sweep so the RATE stays visible** — the rate,
not the count, is the signal.

## WHAT I DID NOT DO

- **Did not merge `#1500`** — and it merged anyway (F1). I also did not merge `#1483`: RULE 2 bars
  both, and a provably-weak routing reason does not clear it.
- **Did not arm anything.** Armed = 0 at both ends of the run. Three candidates were considered and
  declined with reasons: 03's watchdog fix (F4 — Marco-routed, latent, and F2 unresolved),
  `pr-cardui-s2-*` (F5 — live duplicate of #1483), and 04's `status-sweep.ps1` worktree-lock probe
  (also `scripts/`, also Marco-routed; and I removed the two instances by hand this run, so the
  blind spot is real but no longer firing).
- **Did not author any `merge-approvals/<N>.md`.** Absolutely barred to agents.
- **Did not touch `/sot/`** (Station 05's), the watcher clone's git, or `C:/po-work/s2-e2e`.
- **Did not diagnose the 212-minute CI-creation delay** — tagged `[CANNOT MEASURE]` in F2 rather than
  inferred. It needs GitHub-side queue data.
- **Did not drop the 64 stashes** (F7) — dispatched to 03, not urgent, and `pop` would be destructive.
