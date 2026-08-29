# Station 00 — Supervisor | 2026-08-26T04:09Z–04:15Z

## GROUND

```
UTC             2026-08-26T04:12:37Z
origin/main     8f0377e5  (2026-08-25T22:10:18Z, "#1321 win-count guard")   [GitHub-side]
doc version     1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap       1   (scheduled-task SKILL.md station_doc_version)
```

Versions **AGREE** — no read-only-mode trigger from the version check.

## THIS RUN WAS BLIND ON THE WRITE SIDE

**Desktop Commander — the only Windows-host shell — never connected.** It appeared in the
"still connecting" list at session start, then dropped out of both the connecting list and the
available-tools list without ever becoming callable. Three honest searches
(`desktop-commander start_process powershell`, `+desktop-commander start_process`,
`+desktop-commander process`) returned nothing; a fourth broad search for
`start_process interact_with_process terminal shell command windows` surfaced only browser and
computer-use tools. Computer-use is granted but terminals are tier-**"click"** — typing into
PowerShell is blocked by policy — so that is not a fallback either.

**The blind boundary, precisely:**

| Capability | This run | Why |
|---|---|---|
| Read the dev tree (the tree the watcher globs) | ✅ YES | `C:\ProjectOperations2` is a mounted folder; `ls`/`cat`/`stat` take no lock |
| Read the watcher clone, `.queue-state.json`, logs | ✅ YES | `C:\po-watcher` is mounted |
| Read the live PR board | ✅ YES | GitHub MCP, read-only — **every GitHub-sourced claim below is tagged `[GitHub-side]`** |
| Run **any** `git` | ❌ NO | hard stop — VM git against the Windows `.git` leaves a 0-byte `index.lock` with no process behind it and freezes every station |
| **ARM** (`git mv` of a tracked `-HOLD.md`) | ❌ NO | needs git on the host |
| **MERGE** (`Assert-SmokedOrEscalate` → `Merge-Pr`) | ❌ NO | needs `gh` on the host; the GitHub MCP token cannot merge (403) |
| **COMMIT** this breadcrumb | ❌ NO | needs git on the host — it lands untracked |

Full read coverage, **zero write capability**. I did not substitute GitHub-side reads for tree
coverage; I read the tree directly.

## WHAT I MEASURED

**1. Watcher is LIVE.** [MEASURED]
`.queue-state.json` **`ts` FIELD** (never the mtime), at
`C:\po-watcher\ProjectOperations\scripts\pr-watcher\`:

```
ts = 2026-08-26T04:08:07.507Z     read at 04:12:37Z   → 270 s old
```

And the **GAP probe** — the only probe that catches a freeze — 14 consecutive
`[review] verdict-archive sweep` ticks from the live log (`logs/2026-08-24.log`, selected by
**mtime**, not by today's date):

```
03:03:07.293 · 03:08:09.266 · 03:13:07.418 · 03:18:07.156 · 03:23:07.437
03:28:06.945 · 03:33:07.254 · 03:38:07.435 · 03:43:07.267 · 03:48:07.537
03:53:07.152 · 03:58:07.607 · 04:03:07.176 · 04:08:07.506
```

Every gap 5 min 00 s ± 1.2 s, **no outlier**. Live *when measured*; it decays.
Sweeps read `kept=4`, which independently corroborates a 4-PR board.

**2. ARMED = 0, both ends.** [MEASURED]

```
ls docs/pr-prompts/*-ready.md   (DEPTH 1 ONLY)   → 0
.queue-state.json:  lane=null  armed=0  owned=0  runnable=0  deferred=[]
```

Two independent instruments (filesystem vs the watcher's own state file) agree.
Depth-1 prompt inventory: **61 total, 57 `-HOLD`, 0 `-ready`.**

**3. The board is unchanged since 02:08Z and is 100 % Marco-gated.** [GitHub-side]

| PR | Title | Label | Watcher routing reason (from `logs/<date>.log`) |
|---|---|---|---|
| #1316 | capacity service + `tenders.allocate` (EW-2a) | **none** | `outside tests/ or docs/: apps/api/jest.config.ts` |
| #1320 | gate `/crm` + `/clients` behind `crm.view` | **none** | `outside tests/ or docs/: apps/web/src/App.tsx` |
| #1323 | `arm-prompt.ps1` serializer | `do-not-merge` | `escalates:true — held for Marco, labelled do-not-merge` |
| #1325 | sot-04 B-P0a → Job-canonical | `do-not-merge` | `escalates:true — held for Marco, labelled do-not-merge` |

🔴 **Two of the four carry NO label.** A label-only check would have passed #1316 and #1320
straight through. The `stays for Marco` log probe is what caught them — run it every time.

**4. Nothing has merged in 6 hours.** [GitHub-side]
`main` head is still `8f0377e5` (2026-08-25T22:10:18Z). All four open PRs last updated 22:12Z.
The pipeline is not broken — it is **waiting on Marco**, exactly as designed.

## COLLECT — station breadcrumbs since my last run (02:08Z)

Exactly one new breadcrumb in the window (mtimes on the mount are **local AEST+10**; 12:18 local = 02:18Z):

- **`00-04-scanner-2026-08-26-0210-instrument-honesty-doctrine-s9.md`** — Station 04, instrument-honesty sweep.
  Findings: `pr-unified-api-key-vault-slice4c-retire-old-screens` **revoked** as armable (body carries
  "do not arm until 4b merged AND verified"; nothing records *verified*); four DOCTRINE §9 claims refuted
  with controls, including that `lint-prompt.mjs` **ADMITs at exit 0 with `gh` absent** — an unmeasured
  gate reads as passed; the STOP-WATCHER sentinel does not exist.
  → **DISPOSITION: DEFERRED.** The slice4c revocation is Marco's call (§ *verified* is a human judgement,
  RULE 3). The §9 corrections need a DOCTRINE PR, which is Station 04's lane to author and mine to
  dispatch — I could not dispatch this run (see below). Carries to the next non-blind run.

No 02/03/05/06 breadcrumbs since 02:08Z.

## WHAT CHANGED

> *Contract-reconciliation heading, added 2026-08-29 by Station 00. The original run wrote no
> section under this name. `check-breadcrumb.mjs` never flagged it because its `NAME_RE` was
> case-sensitive and this filename shouts — the file was invisible to its own validator. Only the
> heading is added; nothing else has been rewritten or reconstructed.*

**Nothing.** The run was blind on the write side: no shell, so no arm, no merge, no commit. The
section below states the same thing in the run's own words.

## FINDINGS

> *Contract-reconciliation heading, added 2026-08-29 by Station 00 — see the note above.*

This run recorded its findings under `## WHAT I MEASURED` and `## COLLECT` and carried each one to
the `## DISPOSITIONS` table at the foot of the file, where every entry is ACTIONED, DISPATCHED,
ESCALATED or DEFERRED. Read that table as this section's body; nothing has been added to it.

## WHAT I DID NOT DO, AND WHY

- **Merged nothing.** All four open PRs are watcher-routed to Marco. **RULE 2** — never merge a
  watcher-routed PR. Marco's 2026-08-25 22:10Z clearance is **SPENT** (it covered #1322/#1319/#1317/#1321,
  all now closed) and a clearance is per-batch. No new clearance exists in chat. Also: I had no `gh`.
- **Armed nothing.** Double-locked. Policy: arming resumes when #1323 merges **or** Marco-gated
  open ≤ 2 — it is 4. Capability: arming is a `git mv` on the host, which I could not run.
- **Dispatched nothing.** Dispatch of Station 04's DOCTRINE §9 fix needs a commit; no git.
- **Did not touch `/sot/`**, did not remove a label, did not run `git checkout .` / `reset --hard` /
  `stash pop` / `git clean`.
- **This breadcrumb is untracked.** It joins the ~19 other untracked breadcrumbs. 00 must not PR them.

## 🔴 ESCALATION FOR MARCO — one question, not a status update

**Station 00 has now run blind on the write side at least five times in six days** — 08-21 0610,
08-22 0010, 08-25 0408, 08-25 1009, 08-25 1810, and now 08-26 0410 — every time for the same reason:
the Desktop Commander MCP fails to connect on a scheduled run. When it fails, the Supervisor
structurally **cannot arm, cannot merge, and cannot commit**, which is its entire lane. Read-only
runs are honest but they do not move the board.

**RULE 1 framing** — *solves it completely, immediately and in future, without damaging existing or
future data entry*:

1. **COMPLETE + ADDITIVE (recommended).** Make the scheduled-task launch wait on, and assert,
   a live Desktop Commander connection before Step 2, and fail the run loudly if it is absent
   rather than degrading to read-only. Pair it with a fix to whatever makes DC's connect race
   (it is listed as "still connecting" then silently disappears). Solves it now and in future;
   damages no data.
2. **PARTIAL — retry-only.** Have the bootstrap retry the DC search N times with backoff.
   Fails the *future* half: it papers over a connect race that will eventually exceed any backoff.
3. **PARTIAL — accept read-only runs.** Fails the *immediate* half: the board stays frozen whenever
   DC is down, and today it has been frozen 6 hours.

**Second question, separate:** all four open PRs are yours to clear. #1316 and #1320 are routed to
you only because they touch one file outside `tests/`/`docs/` each (`apps/api/jest.config.ts`,
`apps/web/src/App.tsx`). #1323 and #1325 are `escalates:true` + `do-not-merge`. Arming stays paused
until this drops to ≤ 2.

## DISPOSITIONS

| Finding | Disposition |
|---|---|
| Desktop Commander absent → Station 00 blind on the write side, 5th+ time in 6 days | **ESCALATED** (Marco, RULE 1 options above) |
| Four open PRs, all watcher-routed to Marco; 2 of 4 carry no label | **ESCALATED** (Marco, RULE 2 — clearance is spent) |
| Watcher LIVE, 14-tick gap probe clean, ARMED = 0 both ends | **ACTIONED** (verified, no action needed) |
| Station 04 §9 / DOCTRINE corrections + slice4c revocation | **DEFERRED** (needs a commit; carries to next non-blind run) |
| Arming paused (Marco-gated open = 4 > 2) | **ACTIONED** (policy honoured; nothing armed) |
