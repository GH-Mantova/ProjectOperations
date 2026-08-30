# Station 00 — Supervisor | 2026-08-27T16:08Z–2026-08-27T16:25Z

## GROUND

```
UTC            2026-08-27T16:08:34Z
origin/main    71b4fc49            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ cb9fce55      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions AGREE (1 == 1). Full-authority run, not read-only.
**NOT BLIND** — Desktop Commander present, PowerShell on the box reached on the first call.

## WHAT I MEASURED

**Ground and machinery**

- `[MEASURED]` `git rev-parse --short origin/main` → `71b4fc49`; dev tree `main @ cb9fce55`.
- `[MEASURED]` armed at start = **0**. `Test-Path C:\ProjectOperations2\.git\index.lock` → **False**.
- `[MEASURED]` watcher: `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` filtered on
  `pr-watcher[\\/]index\.mjs` → exactly **one** process, **pid 28328**, unchanged from the pid the
  14:08Z run recorded. Never counted or killed by image name.
- `[MEASURED]` `PO Watcher Keepalive` → `Ready`, `LastRunTime 2026-08-27T16:05:01Z`, `LastTaskResult 0`.
- `[MEASURED]` heartbeat (the CLONE's, `C:\po-watcher\...\pr-watcher\heartbeat.log`) was last written
  `14:21:15Z` at the start of this run — ~2 h stale. With **0 armed** that is the CORRECT idle
  reading, not a wedge (DOCTRINE §9.5: the watchdog only ticks mid-run). I did not act on it.
  It was superseded by the arm-to-pickup proof below.

**Trunk**

- `[MEASURED]` `gh api repos/GH-Mantova/ProjectOperations/commits/71b4fc49/check-runs` → **13/13**,
  all `completed/success`, every job `started_at 2026-08-27T14:28:0xZ`. Read **per-commit**, never
  from `gh run list --branch main` (DOCTRINE §9.4) and never from `status-sweep.ps1`'s trunk colour.
- `[MEASURED]` those runs started **after 12:00:00Z**, so this is a genuine post-bomb green and not
  the trap the 14:08Z run named (main @ `01ad020e` read green only because its API job ran *before*
  the fuse). #1354's fix holds.

**Board**

- `[MEASURED]` `gh pr list --state open` → **1** PR. `#1353 [UNSTABLE] labels=(none)`
  `feat(pipeline): check-sot-refs + wire five sot/pipeline checkers into CI`.
- `[MEASURED]` RULE-2 probe, re-run live this cycle:
  `processed/pr-lessons-folder-s3-ref-checker-ready.md.log` →
  `[watcher] merge result for PR #1353: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}`
  Note the label list is **empty** — a label-only check would have missed this entirely.

**Queue**

- `[MEASURED]` `Get-Command gh` → `C:\Program Files\GitHub CLI\gh.exe`. `gh` resolves, so every ADMIT
  below is an ordinary-strength ADMIT (DOCTRINE §9.5).
- `[MEASURED]` `lint-prompt.mjs` (read-only; no `--dequeue`) over all 60 `pr-*HOLD*.md`:
  7 PROMOTE, 22 ADMIT, 31 REJECT.
- `[MEASURED]` RULE-4 marker sweep, case-sensitive, over the **union** of six syntaxes
  (`do-not-arm`, `DO NOT ARM`, `do not arm`, `NEVER ARM`, `docs/approvals`, `requires_`), globbing
  `pr-*-HOLD.md` and not `*.md`. **Positive controls both fired:**
  `pr-524-rates-b-slice2-canonical-HOLD.md` (prose `DO NOT ARM`) and
  `pr-siteid-notnull-backfill-HOLD.md` (`<!-- watcher: do-not-arm -->`). The instrument works.
- `[MEASURED]` `pr-queue-armed-tracked-detector-HOLD.md` — the prompt project memory nominated as
  "next in order" — **is NOT armable.** `lint-prompt.mjs` → REJECT exit 1. Its
  `requires_on_main: .github/workflows/ci.yml :: check-sot-refs` is **unmet**:
  `git show origin/main:.github/workflows/ci.yml` contains zero `check-sot-refs` matches, and
  `git ls-tree -r origin/main -- scripts/pipeline/check-sot-refs.mjs scripts/pipeline/check-armed-tracked.mjs`
  returns nothing. **Positive control:** the same `ls-tree -r` DOES return
  `scripts/pipeline/lint-prompt.mjs`, so the query is not blind.
- `[MEASURED]` shared dev-tree index before I touched it carried one foreign staged entry:
  `R100 pr-guard-s1-verdict-file-list-HOLD.md → ...-ready.md` (already consumed; it is in
  `processed/`). I left it alone and committed nothing in the dev tree.

**The dated-time-bomb class — the 14:08Z run's open lead, now closed**

- `[MEASURED]` probe: a literal `new Date("20…")` in a spec, cross-checked against whether the
  subject reads the real `Date.now()`. Ran over `apps/**/*.{spec,test}.{ts,tsx}`.
- `[MEASURED]` `apps/web/src/pages/crm/__tests__/AccountsListPage.test.ts:19` pins the **same**
  literal as the API bomb, `2026-08-14T12:00:00Z` — but every call site passes it in:
  `computeGoingCold("ACTIVE", daysAgo(15), NOW)`. And
  `apps/web/src/pages/crm/AccountsListPage.tsx:36-40` declares
  `computeGoingCold(lifecycle, lastContactedAt, nowMs = Date.now())`. The clock is **injected**.
- `[MEASURED]` positive control on the discriminator: `git show 71b4fc49` — #1354's fix is *exactly*
  "add an optional `nowMs` param, pass it from the spec". That is the shape the web side already had.
  So the probe distinguishes bombed (pre-#1354 API) from safe (web), and it is calibrated.
- `[MEASURED]` the other future-dated fixtures are inert: `calendar.service.spec.ts`'s `2027-01-01`
  shifts are returned by a **jest-mocked** `prisma.findMany`, so `calendar.service.ts:39`'s
  `endAt: { gt: now }` filter never actually evaluates; `bid-prioritisation.service.ts` contains no
  `Date.now()` / `new Date()` at all and only passes `dueDate` through.
- ⇒ **`AccountsListPage.tsx` is NOT a second copy of the bug. The lead is REFUTED, not deferred.**

**Collection — breadcrumbs since my last run (14:08Z)**

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → 61 checked, 9 malformed, exit 1.
New since 14:08Z: `00-04-scanner-...-1410-instrument-honesty.md` and
`00-05-sot-keeper-...-1411-sot03-nine-replacement-chars-sot04-in-sync.md`. Dispositions below.

## WHAT CHANGED

1. **ARMED one prompt** (one at a time, RULE 4 satisfied) —
   `git mv docs/pr-prompts/pr-crm-lastmile-s1-unblank-todos-and-notes-HOLD.md ...-ready.md`.
   Read back: armed on disk **0 → 1**; the `-HOLD.md` is gone; `git diff --cached --name-status`
   carries **only** my `R100` plus the pre-existing foreign one. Left staged and uncommitted, as
   every prior arm is — I did not commit or push in the dev tree.
2. **Opened PR #1355** from a **disposable worktree** off `origin/main@71b4fc49`
   (`C:\po-worktrees\fix-instr-1630`), never the dev tree and never `C:\po-watcher`. Two one-line
   instrument fixes; commit `281bae40`, `2 files changed, 2 insertions, 2 deletions`. Native squash
   auto-merge armed and read back (`autoMergeRequest` non-null). At 16:24Z: 11 checks SUCCESS,
   `tendering-e2e` and `API` still IN_PROGRESS, CP gates green. That `API` run started **after
   12:00Z**, so it is also a live re-confirmation that #1354's fix holds.
3. **The armed prompt completed and opened PR #1356** at ~16:29Z. Armed at depth 1 is back to 0.
4. **Compacted project memory** — 22.1 KB → ~16 KB by lifting the two long `## Standing …` sections
   wholesale into `project_standing_traps_and_findings_full.md`, which is exactly what the previous
   compaction's own note prescribed and what four runs had deferred. Nothing was retired; the index
   now carries one pointer block each and names the file to read.
5. Nothing else. No merges, no labels touched, no watcher restart, no lock cleared, no `sot/` edit.

## FINDINGS

### FINDING 1 — the board's one open PR is RULE-2 held, and it gates the queue behind it

`[MEASURED]` #1353 carries `"marco":true` with reason `outside tests/ or docs/: .github/workflows/ci.yml`
and **no label**. It is watcher-routed to Marco. I did not merge it and will not; its `rev-1353`
MERGE verdict does not clear RULE 2.

`[MEASURED]` the cost is now concrete rather than abstract: `pr-queue-armed-tracked-detector-HOLD.md`
REJECTs solely because `check-sot-refs` is absent from `ci.yml` on main — which is what #1353
delivers. The chain **#1353 → `check-sot-refs` on main → the armed-but-untracked detector** is stalled
at its first link, and the detector is the thing that would stop a `-ready.md` going invisible under
`.gitignore:75`. Three sets of those have already been rescued by hand.

The 14:08Z run escalated #1353 with the 115-unresolved-`sot/**`-refs question and recommended
**A: land non-blocking → clean refs → make blocking**. Nothing has changed that answer, and I am not
re-asking it. This finding adds one fact to it: the wait is no longer free.

**DEFERRED** — it becomes urgent the moment a second prompt in that cluster reaches PROMOTE, or the
moment another untracked `-ready.md` is found by hand. Marco's answer on #1353 is the unblock and it
is already in front of him.

### FINDING 2 — `check-breadcrumb.mjs` declared Station 03 SILENT again; 03 was on schedule

`[MEASURED]` this run's `--freshness` printed `03  last 2026-08-26T23:01:00Z  17.1h ago  (cadence 4h)  SILENT`.
`[MEASURED]` 03's only two contract-era breadcrumbs are dated `2026-08-25-2301` and `2026-08-26-2301`
— **exactly 24 h apart, to the same minute**. The cron is daily. At `CADENCE['03'] = 4` the collector
reports SILENT from 8 h after 03's last report onward, i.e. for two thirds of every day, so **every**
Station 00 run since the contract landed on 2026-08-25 has had to disposition a false SILENT.

Fixed to `24` in PR #1355. Read back in the worktree: `03 ... 41.3h ago (cadence 24h) ok`.

**ACTIONED** — verified by `node scripts/pipeline/check-breadcrumb.mjs --freshness` in a clean
worktree off `71b4fc49`, and `lint-station.mjs` → ADMIT all 7, exit 0. PR #1355, auto-merge armed.

### FINDING 3 — Station 05's audit step 5 audited four tasks that have not existed for months

Collected from `00-05-sot-keeper-2026-08-27-1411-*.md`, which reported it for the **second**
consecutive run and DISPATCHED replacement text to me. Re-verified rather than repeated:

`[MEASURED]` `Get-ScheduledTask` over every visible Windows task returns **none** of `pr-shepherd`,
`night-qa`, `watcher-triage`, `feature-queue-watch`. The only project task is `PO Watcher Keepalive`.
**Positive control:** the same call *does* return `PO Watcher Keepalive` (`Ready`, result 0) — so the
instrument works and the **fixture in the document** is what is wrong.

Step 5 now names an instrument — watcher PID **plus command line**, whatever restarter tasks the live
task list actually holds, and `processed/` mtimes — with an explicit *"read the live task list; do not
enumerate task names from this document"*, plus a one-line record of what was wrong so the next reader
does not re-derive it. That is 05's own proposed text, applied.

**ACTIONED** — PR #1355. Edited with node (`readFileSync`/`writeFileSync`, utf8) per DOCTRINE §9.3,
not PowerShell; `git diff --numstat` → `1 1` per file, and a re-read found zero `U+FFFD`.

### FINDING 4 — the `AccountsListPage` mirror is clean; the time-bomb class had exactly one member

Project memory carried `AccountsListPage.tsx:26` as "NOT audited, likely a second copy of the same
bug". It is not. `computeGoingCold` already takes `nowMs = Date.now()` and the spec passes `NOW`
explicitly — the same fix shape #1354 had to add on the API side. The two other future-dated fixtures
are inert for the reasons measured above.

**ACTIONED** — the lead is closed by measurement. The durable output is the probe, which is worth
keeping: *a literal `new Date("20…")` in a spec is only a bomb when the subject reads the real clock
instead of being handed one.* A pinned date passed **into** the subject is the fix, not the fault.

### FINDING 5 — nine `U+FFFD` committed in `sot/03`, unrecoverable from history

Collected from `00-05-sot-keeper-2026-08-27-1411-*.md`: lines 7327–7341 of `sot/03-progress-log.md`
carry nine replacement characters, and **both** commits in that file's history carry the same nine, so
the original characters are not recoverable from git. Only Marco knows what they were meant to say.
Restoring them is a content decision, not a mechanical repair, and `sot/` is 05's lane exclusively —
I may not edit it and would not guess at it if I could.

**ESCALATED** — see the question at the end of this file.

### FINDING 6 — DOCTRINE §9.5's lint-waiver guard names the wrong mechanism

Collected from `00-04-scanner-2026-08-27-1410-instrument-honesty.md`: §9.5 says the `origin/main:`
file-gate is silently waived when **`gh`** is missing, and prescribes confirming `gh` resolves. 04
measured the mechanism to be **`git`**, three ways, and measured the prescribed guard's detection rate
at **0 %**. I complied with the prescribed guard this run anyway (`gh` does resolve) — which is
precisely the problem: it passes without proving anything.

I did not fix it. §9 is a `CANONICAL-BLOCK` gated by `lint-station.mjs`; changing it re-records a hash
that six station docs depend on, and shipping that as a by-product of a two-line instrument PR is how
a wedged board happens. It wants its own scoped change.

**DEFERRED** — real, not now. It becomes urgent the moment a prompt with a genuine `origin/main:`
file-gate is armed on the strength of an ADMIT, because that is the case where the waiver decides
something. Nothing armed this run relied on one: `pr-crm-lastmile-s1` was verified by hand
(`CRM_BUILD_ORDER_V1` read directly out of `git show origin/main:docs/plans/crm-build-order-plan.md`).

### FINDING 7 — arm-to-pickup, and what I armed

`[MEASURED]` `pr-crm-lastmile-s1-unblank-todos-and-notes` — premise
`grep -q "accountId: null, contactId: null" apps/web/src/pages/crm/RelationshipsPage.tsx` verified
**LIVE against `origin/main`**, not against the dev tree. Its `requires_on_main` marker
`CRM_BUILD_ORDER_V1` verified present on main. TRACKED. `lint-prompt.mjs` → PROMOTE exit 0 with `gh`
on PATH. Zero do-not-arm markers under the six-syntax union whose positive controls both fired. Not on
the never-arm denylist.

It is worth naming what this one is: the relationship-note form posts **both** foreign keys as `null`,
the service rejects it, so "Add note" returns 400 on every click — which means *Last contact* and
*Going cold* can never populate for any user. Web-only, size 3, no chain dependency on the
Marco-gated #1353. It restores data entry rather than touching it, which is the RULE-1 reason it went
ahead of the other six PROMOTE candidates.

`[MEASURED]` **arm-to-pickup, the one liveness probe that does not lie:** heartbeat at
`2026-08-27T16:15:01Z` reads `pr-crm-lastmile-s1-unblank-todos-and-notes-ready.md elapsed=60s`, still
pid 28328. The watcher is alive and consuming, proved by making it do work rather than by asking it
how it feels.

`[MEASURED]` **and it landed a PR.** At 16:29:14Z the armed prompt had been consumed, armed at depth 1
was back to **0** (only `rev-1355`/`rev-1356` review jobs remain, which are not arms), and the board
carried a new **#1356 [BLOCKED]**. Full cycle in ~15 minutes: arm → pickup → build → PR.

**ACTIONED** — armed, picked up, built, PR #1356 open. Not merged by me: it will carry the watcher's
own routing decision, and whichever way that falls is not mine to override.

## WHAT I DID NOT DO

- **Did not merge #1353.** Watcher-routed to Marco, re-measured live this run. RULE 2 is not cleared
  by green, by an absent label, or by its own MERGE verdict.
- **Did not re-raise the RULE-2 root cause.** The 12:08Z run measured it — ruleset "Main" (15532058)
  requires only CodeQL · API · Web · tendering-e2e, so the CP-gate job is **not** required and every
  CP gate is advisory. It is escalated with options A–D and changing a ruleset is an authorization
  grant, which is Marco's absolutely. Re-escalating it every two hours is noise, not diligence.
- **Did not touch the clone.** `C:\po-watcher\ProjectOperations` still holds `355dfdec` (a
  verdict-on-pr-1339 commit that exists nowhere else). No FF, no restart — a restart adopts nothing
  and the watcher was mid-run on my armed prompt for most of this cycle. Clone drift is 03's lane and
  03 reports at 23:01Z tonight.
- **Did not clear or touch any lock.** There was none (`index.lock` → False, twice).
- **Did not commit in the dev tree.** The arm is staged, as every prior arm is. The foreign
  `pr-guard-s1` `R100` in the shared index is not mine and I did not `git reset` it — that is the
  LL-38 collision.
- **Did not arm a second prompt.** Six other PROMOTE candidates are clean and waiting
  (`crm-wincount-s3-recompute`, `dns-s4-checker-warn-only`, `e2e-container-s2-swap-required-job`,
  `guard-s2-prompt-search-by-branch`, `guard-s3-file-gate-not-released`, and untracked
  `rates-11b2-resolver-isactive-surface`, which needs `git add` before it can be armed in my lane).
  One at a time.
- **Did not edit `sot/`.** Not my lane, at all, ever.
- **Did not "fix" the Keepalive task.** `Ready`, result 0 at 16:05Z. `wrapper=0` alone is never a fault.
- **Did not quote a trunk colour from `status-sweep.ps1`.** Its `TRUNK IS RED` is a coin flip. I read
  `check-runs` per commit instead.

---

## ESCALATED — for Marco. One question.

**`sot/03-progress-log.md` lines 7327–7341 carry nine `U+FFFD` replacement characters, committed on
`main`, and both commits in that file's history carry the same nine.** The original characters are
gone from git. Station 05 measured this with node (not `Get-Content`, which reports false mojibake),
so they are real, not a reader artefact. Only you know what they were meant to say.

Applying RULE 1 — *solves it completely, immediately and in future, without damaging existing or
future data entry* — the options, complete-and-additive first:

**A. Repair the nine in place from your reading of the surrounding lines, and add a `U+FFFD` check to
the `sot/` lint so it can never re-enter.**
Passes both halves. It fixes the nine that exist **and** closes the door on the next nine, and it
touches nothing but corrupted bytes in a log — no data entry, existing or future, is affected. It
costs you one read of fifteen lines. 05 can prepare the exact diff for your approval; you supply only
the missing characters.

**B. Add the `U+FFFD` lint gate now, and leave the nine as they are.**
Fails the *immediately* half — the nine stay wrong in the source of truth, and a reader will
eventually cite a mangled line. It does pass *future* and it damages nothing, so it is a legitimate
partial if you have no time for the fifteen lines this week.

**C. Repair the nine, no lint gate.**
Fails the *future* half outright. The double-encoding path that put them there is still open and it
has already produced 133 sequences across five station docs once (repaired 2026-08-24). This one
comes back.

**D. Leave both.**
Fails both halves. Named only so the do-nothing option is on the record.

My recommendation is **A**. If you would rather not spend the read, **B** now and **A** later is
honest; **C** is the one I would argue against, because the mechanism is what produced this.

---

⚠️ This breadcrumb is UNTRACKED until a board PR commits it (`docs/pr-prompts/` is tracked, but a new
file in it is not). It reaches nobody until then — the next Station 00 run should sweep it up.
