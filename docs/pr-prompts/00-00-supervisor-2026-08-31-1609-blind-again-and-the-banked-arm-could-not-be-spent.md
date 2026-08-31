# Station 00 — Supervisor | 2026-08-31T16:09Z–2026-08-31T16:1xZ

> 🔴 **THIS WAS A BLIND RUN.** Desktop Commander did not connect (`CONNECT_TIMEOUT`, 30000 ms), so
> there was no PowerShell on the Windows host. Per PREFLIGHT step 1 this run **STOPS**: no sweep, no
> arm, no merge, no dispatch executed on the box. Nothing below is offered as coverage of a sighted
> run. **A blind run and a healthy quiet run both produce "no news" — this was the blind kind.**

## GROUND

```
UTC            2026-08-31T16:09Z
origin/main    f4f6ddc6            [FILE READ of .git/refs/remotes/origin/main — NOT a fetch; may be stale]
dev tree       main @ f4f6ddc6     C:\ProjectOperations2   (.git/HEAD -> refs/heads/main)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (1 = 1). No version-mismatch read-only trigger.

⚠️ The `origin/main` line is a **file read of a ref that only moves on a fetch**, not `git rev-parse`
after `git fetch`. It equals the END sha of the 14:08–14:45Z run, which is consistent with "nothing
landed since" but does **not prove** it. Treat it as `[INFERRED]`.

## WHAT I MEASURED

Everything below was read from the mount `/sessions/<id>/mnt/ProjectOperations2/`, which **is** the
real watcher tree (read-write). **No `git` was run against it** — a cut-short VM-side git call leaves
the 0-byte `index.lock` that freezes every station.

| Claim | Method | Verdict |
|---|---|---|
| Desktop Commander unreachable | `ToolSearch` ×3 over ~60 s; server reported `CONNECT_TIMEOUT` after 30000 ms | **[MEASURED]** BLIND |
| Dev tree branch + SHA | `cat .git/HEAD`, `.git/refs/heads/main` | **[MEASURED]** `main @ f4f6ddc6` |
| Dev tree converged with last-fetched `origin/main` | `.git/refs/heads/main` == `.git/refs/remotes/origin/main` | **[MEASURED]** identical |
| No wedge state | tested for `index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `BISECT_LOG`, `rebase-merge`, `rebase-apply` under `.git/` | **[MEASURED]** none present |
| ARMED count | `ls docs/pr-prompts/*-ready.md` (depth 1 only — the only depth the watcher globs) | **[MEASURED]** **0** |
| Live HOLDs at depth 1 | `ls docs/pr-prompts/*-HOLD.md \| wc -l` | **[MEASURED]** **60** |
| `pr-lint-not-a-prompt-HOLD.md` still on disk, unarmed | `ls` | **[MEASURED]** present, `-HOLD` |
| `pr-sweep-worktree-liveness-HOLD.md` still on disk, unarmed | `ls` | **[MEASURED]** present, `-HOLD` |
| Station freshness | **HAND-CHECKED** from filename stamps against `CADENCE` at `check-breadcrumb.mjs:36` (`00`:2h, `03`:24h, `04`:4h, `05`:24h; SILENT = past 2×) | see below |
| Watcher process alive | — | **[CANNOT MEASURE]** — needs the box |
| `status-sweep.ps1` verdict | — | **[CANNOT MEASURE]** — needs the box |
| OAuth credential at `C:\Users\Marco\.claude\.credentials.json` | — | **[CANNOT MEASURE]** — on no mounted path |
| Open-PR board, checks, labels, RULE-2 routing | — | **[CANNOT MEASURE]** — and a GitHub-side read is explicitly **not** a substitute (station doc, PREFLIGHT 1) |
| `check-breadcrumb.mjs` / `lint-*.mjs` | — | **[CANNOT MEASURE]** — they `execSync` git at `:98-101`; a mount-only run must not run them ⇒ **this run does not and cannot write `breadcrumb-clean`** |

**Freshness, hand-checked (ages at 16:09Z):**

| Station | Newest breadcrumb stamp | Age | Cadence | SILENT at | Verdict |
|---|---|---|---|---|---|
| 00 | 2026-08-31-1445 | 1.4 h | 2 h | 4 h | ok |
| 03 | 2026-08-30-2301 | **17.1 h** | 24 h | 48 h | ok — but see F3 |
| 04 | 2026-08-31-1410 | 2.0 h | 4 h | 8 h | ok |
| 05 | 2026-08-31-1411 | 2.0 h | 24 h | 48 h | ok |
| 06 | 2026-08-31-0137 | 14.5 h | **absent from `CADENCE`** | never | invisible (open escalation) |

**COLLECT — nothing new to collect.** The only station breadcrumbs at depth 1 are the four 00 crumbs
from the 12:09/14:08/14:25/14:45Z runs plus 04's 1410 and 05's 1411 — **all six were already
dispositioned by the 14:45Z run.** No breadcrumb has been written by any station since 14:45Z.

## WHAT CHANGED

**Nothing.** No arm, no disarm, no merge, no label, no dispatch, no `sot/` edit, no git operation of
any kind. The only write this run made anywhere is **this file**, created untracked in the dev tree
at `docs/pr-prompts/`. A breadcrumb filename matches no watcher glob, so it arms nothing.

## FINDINGS

### F1 — Station 00 was blind again: Desktop Commander timed out at 30 s, so the whole lane is shut

`ToolSearch` was called three times across ~60 s; the MCP host finally reported
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out
after 30000ms"`. `plugin:prisma:Prisma-Local` timed out in the same window, which points at the local
stdio-server launch path rather than at this one server. That is a **new detail** on an old, still-open
escalation ("DC blindness ≈40 % of 00's runs, CAUSE UNKNOWN"): previous blind runs recorded *absence*;
this one recorded a **30-second connect timeout on two local stdio servers at once**. The cause is
still not known and remains Marco's, but the next sighted run now has a sharper question to ask —
whether the two local stdio servers share a launcher or a port.

**DISPOSITION: ESCALATED** — folded into the existing DC-blindness escalation, which is already with
Marco. The new evidence (simultaneous `CONNECT_TIMEOUT` on **two** local stdio MCP servers, not a
silent absence) is added to it. No new option set is offered: the RULE-1 options already filed stand.

### F2 — The banked arm could not be spent, for the second consecutive run, for a different reason

`MEMORY.md` names one next action: **arm `pr-lint-not-a-prompt-HOLD.md`**, with the full RULE-4
detector output banked by the 14:08Z run so it does not need re-deriving. It is still on disk as
`-HOLD` and ARMED is still 0. **Arming is a `git mv` of a tracked file** — the one operation a blind
run is categorically barred from, because it must not run `git` against the mount.

This is the second run in a row that has failed to spend that arm: the 14:08Z run's own falsifier
fired and it retracted mid-run (correctly, single-actor rule); this run was blind. Both retreats were
right. The item is nonetheless now ~2 h old with no owner but "the next run that can".

**This is direct corroboration for the open OPEN-DISPATCHES escalation** — *"DISPATCHED → a FUTURE
RUN is a disposition with no owner, no deadline and no instrument"* — and it is the third
corroboration in about a day. `--freshness` watches **stations**, not **items**, so nothing anywhere
counts this park; only project memory does, and memory is not an instrument the pipeline reads.

**DISPOSITION: DEFERRED.** Trigger: **the next Station 00 run that reaches the box.** It becomes
urgent the moment `scripts/pipeline/lint-prompt.mjs` changes on `main`, because that invalidates the
banked detector output and the next run pays to re-derive it. Also still staged and unarmed:
`pr-sweep-worktree-liveness-HOLD.md` (ADMIT size 3).

### F3 — Station 03 will cross its own cadence within seven hours and nobody is watching the crossing

03's newest breadcrumb is `2026-08-30-2301`, **17.1 h old**. `CADENCE['03'] = 24`, and
`check-breadcrumb.mjs` only calls SILENT past **2×** — i.e. 48 h, at 2026-09-01T23:01Z. So 03 will sit
between 24 h and 48 h stale for a full day while every instrument reports it `ok`. Memory already
carries a dispatch to 03 (re-measure the watcher clone: `dirty=2`, 55 stash entries, `git branch -r`
69 vs `ls-remote` 25 ⇒ **44 phantom refs, up from 33 in two days**), and that dispatch is **not
visible in any freshness reading either**.

I am not filing this as a defect in `check-breadcrumb.mjs` — 2× is a deliberate, documented tolerance.
I am filing it because it is the *same shape* as F2: the instrument tracks stations, the risk lives in
items.

**DISPOSITION: DEFERRED.** Trigger: 03 posting nothing by **2026-09-01T00:00Z** (24 h) — at which
point the next sighted 00 should treat 03 as overdue by policy rather than waiting for the 48 h
SILENT, and re-dispatch the phantom-refs measurement.

### F4 — A blind run cannot validate its own breadcrumb, so this one is hand-checked only

`check-breadcrumb.mjs` and `lint-*.mjs` `execSync` `git ls-tree` / `git ls-files` at `:98-101`.
Running them from the sandbox risks the 0-byte `index.lock` that freezes every station, so they were
not run. This file was instead **hand-checked**: filename matches `00-<NN>-<station>-<YYYY-MM-DD>-<HHMM>-<slug>.md`;
the five contract sections are present, in order, spelled exactly; every finding ends in exactly one
literal disposition; the path is `docs/pr-prompts/`, which is tracked, and is not one of the five
gitignored `docs/qa/` sinks nor any `.gitignore:76-83` sink folder.

**This run does NOT claim `breadcrumb-clean`, and no later run may quote it as such.**

**DISPOSITION: ACTIONED** — the constraint was obeyed and the limitation is stated in-file rather
than papered over. Verification: the hand-check above; the next sighted run's
`check-breadcrumb.mjs --freshness` is the real proof and should be read as this finding's read-back.

## WHAT I DID NOT DO

- **No sweep.** `status-sweep.ps1` needs the box. No `[LIVE]` line exists for this run, and I did not
  manufacture one.
- **No board read presented as coverage.** The GitHub MCP is reachable and read-only, but PREFLIGHT 1
  forbids substituting `origin/main`-side reads for the tree the watcher globs, so I did not sweep the
  board, did not check RULE-2 routing on the two open PRs, and report the board as `[CANNOT MEASURE]`.
- **No arm.** `pr-lint-not-a-prompt-HOLD.md` stays `-HOLD` (F2). Arming needs `git mv`.
- **No merge.** Merging needs `Assert-SmokedOrEscalate` → `Merge-Pr` in a real shell. The GitHub MCP
  token cannot merge and is write-403 regardless.
- **No dispatch executed.** With no live channel and no shell, a "dispatch" this run issued would be
  exactly the ownerless park F2 is about. 03's outstanding phantom-refs item is carried in F3 with a
  dated trigger instead.
- **No `sot/` edit** — never 00's, in any state.
- **No `git` of any kind against the mount** — the `index.lock` hazard.
- **No PR opened.** A blind run's only write channel is an untracked file in the dev tree; the GitHub
  MCP returns `403 Resource not accessible by integration` on `create_branch` (measured 08-30 twice).

---

**This breadcrumb is UNTRACKED.** The next Station 00 run that reaches the box must commit it in its
board PR, or it dies here.
