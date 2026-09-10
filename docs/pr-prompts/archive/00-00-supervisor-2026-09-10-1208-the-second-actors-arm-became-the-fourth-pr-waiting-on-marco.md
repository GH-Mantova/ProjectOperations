# Station 00 — Supervisor | 2026-09-10T12:08Z–2026-09-10T12:3xZ

## GROUND

```
UTC            2026-09-10T12:08:51Z
origin/main    e4ecd9a5            (fetch --prune, then rev-parse)
dev tree       main @ e4ecd9a5     C:\ProjectOperations2   (0 ahead / 0 behind, 9 untracked, 0 modified)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only on that account.

**SIGHTED.** `start_process` shell `powershell.exe` returned a live prompt on the first call, after
`ToolSearch` loaded the Desktop Commander schemas — a validation error before the load is an
unloaded schema, not an unreachable machine.

All three binding documents were read **in full** from the working copy, and only after proving the
working copy is byte-identical to `origin/main` by the sanctioned probe — no pipe, no length
comparison: `git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md docs/pipeline/stations/00-supervisor.md` returned **EMPTY**,
and `git rev-parse origin/main:docs/pipeline/DOCTRINE.md` = `git hash-object
docs/pipeline/DOCTRINE.md` = `6198a12b`. [MEASURED]

**vm-git-guard: INSTALL FAILED — reported, not stopped on.** Installer's last line, verbatim:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
... is under Plan9 share "c" which is not mounted
```

The VM transport was unreachable for the whole run, so no VM-side `git` could have run against the
mount and no `index.lock` exposure arises. Desktop Commander — the transport that matters, and the
only one that can RUN anything on the host — was present throughout. See finding F4.

`status-sweep.ps1` captured to a file (it returns early and hides its own section 7 otherwise) and
decoded `utf16le`: the capture was **131,940 bytes** opening `FF FE`, the trap section 9.3 names,
which halves to 65,969 chars. Section 7 verdict: **SAFE TO ACT**. Section 0 positive controls both
passed (`gh` reached GitHub; `node` runs).

## WHAT I MEASURED

Fresh needles minted for this run — `zqQ00N20260910T1216x` and `zqQ00NoSuchKey20260910T1225` — **0
hits everywhere they were used**, and spent the moment this file lands.

### The board — 4 open PRs, and all four are Marco's

[MEASURED] 12:15Z, `gh pr list -R GH-Mantova/ProjectOperations` (`-R` passed explicitly per section
9.4's CWD trap; `gh_exit=0`, 1050 chars, assign-then-count → 4, never `@(ConvertFrom-Json …).Count`):

| PR | state | labels | created | watcher verdict, verbatim from `processed/pr-*.log` |
|---|---|---|---|---|
| `#1850` | BEHIND | `[]` | 12:02:05Z | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` |
| `#1845` | BLOCKED | `[]` | 09:37:57Z | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` |
| `#1832` | BEHIND | `[]` | 00:12:33Z | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` |
| `#1823` | BLOCKED | `[]` | 2026-09-09T00:05:42Z | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |

**RULE 2 probe calibration, tree PINNED to `C:\ProjectOperations2\docs\pr-prompts\processed`** — the
live tree, never the clone decoy whose own positive control passes while it clears everything since
17 August: **2116** logs · newest `12:11:44Z`, younger than the oldest open PR by 36 hours · the
probe written without a quote character, `-Pattern 'marco.:true'` → **629** · freshly-minted needle
→ **0** · `PR #999999` → **0** · matched on `PR #<n>` in the log BODY over `pr-*.log` only, excluding
the `rev-*` review jobs that name PRs in both lanes.

**And the control that proves `NO LOG` means second lane rather than a broken probe:** `#1849`,
`#1848` and `#1847` — three board docs PRs this station's own lane opened — read **0** prompt-log
hits each, while all four open PRs read **2**. Opposite inputs, opposite answers.

`#1823`'s verdict says "labelled do-not-merge" and its labels now read `[]`. That is not a
clearance: **Marco removing the label does not clear RULE 2**, and section 10.1 step 1 runs first and
wins. **Nothing on this board was mergeable by me.**

### Arming — 0 of 9, with BOTH control layers passed

`triage-holds.ps1` at 12:20Z, both its own controls PASS (GIT control read 149,558 chars of
`origin/main:DOCTRINE.md`; SPENT control emitted exit 3 on the fixture, so that bucket is
measurable): **40** `-HOLD.md` at depth 1 · spent **0** · gates-satisfied **9** · still-gated **31** ·
unreadable **0** · spent-behind-a-REJECT **0**. One duplicate candidate flagged
(`pr-company-manage-s1-permission-and-grant-HOLD.md`, **1 of 4** against `#1823`) — over a
single-entry overlap the test's precision is zero by construction, so it is a candidate and never a
verdict, and it is moot because that prompt fails on a migration path anyway.

I read `classifyPolicyFiles` **from source** rather than trusting the shorthand, and section 10.1's
falsifying probe passes: `NESTED_TEST_PATHS` on `origin/main` still holds all **three** forms
(`/^(tests|docs)\//`, `/(^|\/)__tests__\//`, `/\.(test|spec)\.[cm]?[jt]sx?$/`), not the single regex
whose return would make that paragraph wrong again.

Then I classified all nine, **controlling the EXTRACTION step separately from the DECISION step** —
which is the whole point of the section 9.3 bullet that landed at 08:5xZ today, because three
classifier controls can all pass while the parser feeding them returns null on every file:

```
EXTRACTION CONTROLS  POS(scope, expect >0)=8  NEG(absent key, expect 0)=0
                     broken_\s*\n_form_matches=false
DECISION CONTROLS    docs/x.md=true  a/__tests__/b.mjs=true  a/b.spec.ts=true
                     tests/c.test.ts=true  scripts/c.ps1=false  migrations=false
```

The broken `\s*\n` matcher reading **false** on a file the CRLF-explicit form parses to 8 entries is
that bullet's own falsifying probe, re-run: it did not match, so the bullet stands.

Scope counts parsed `8 6 4 2 5 6 3 6 4` — non-zero on all nine. Result: **TESTS-DOCS ELIGIBLE = 0 of
9.** Three fail on `apps/api/prisma/migrations/**`; six on a path outside `tests|docs`
(`apps/web/src/lib/contrast.ts`, `.github/workflows/playwright.yml`, three
`apps/api/src/modules/**`, `apps/api/src/modules/rates/charge-step-parity.service.ts`).

### Freshness crossed against `lastRunAt` — all five healthy, and the known blind spot restated

`check-breadcrumb.mjs --freshness`: structure **2 checked / 0 malformed**, `CLEAN`, exit 0. Crossed
against the scheduled-tasks MCP, which is the only live schedule:

| station | cron | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| 00 | `5 * * * *` | `12:08:09Z` (**this run**) | 11:40Z | both fresh and aligned |
| 03 | `0 9 * * *` | 2026-09-09T23:01:42Z | 2026-09-09T23:01Z | both fresh and aligned |
| 04 | `0 */4 * * *` | `10:09:47Z` | 10:10Z | both fresh and aligned |
| 05 | `10 0 * * *` | 2026-09-09T22:01:58Z | 2026-09-09T22:02Z | both fresh and aligned |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | n/a — not a station | healthy, weekly |

**No station read SILENT, so no transcript needed to be opened.** `CADENCE['00']` is still `2`
against an hourly cron, so that `ok` remains a weaker statement about 00 than about any other row —
already filed, not re-raised, and F2 is what it cost today.

### main, and the machinery

main CI on the **full** 40-char SHA `e4ecd9a567eb8d4c1c43682f5454b38b1dc491a1` (the short form
answers `[]` at exit 0): **CI success · Push on main success · Deploy success · Tendering Browser
Smoke in_progress · 2 × Claude Code skipped. Zero failures.** Not yet fully green, and not a defect.

Watcher node RUNNING **pid 18228** · auto-restart wrapper alive (1) · heartbeat **0 min** · watcher
clone `branch=main dirty=1` · guard hook present · `index.lock` **False / False** in both trees ·
git processes **0** · no PR touched on GitHub in the last 2 min. `restart-watcher-if-wedged.ps1` was
not needed and not run: node RUNNING with the wrapper alive and an empty queue is **idle**, not
wedged, and a heartbeat that ticks only mid-run cannot separate the two by age alone.

**Armed: 0.** `rev-1850-ready.md` was in flight at 12:10Z and had completed by 12:16Z; no
`*-ready.md` remains on disk. A `rev-*` file is an auto-generated REVIEW JOB, not a prompt, so
`armed=1` in the 12:10Z sweep was never one arm.

Two non-main worktrees, and **neither is safe to prune**: `C:/po-vg` at **8897 min** (6.2 days)
holding one uncommitted file, already escalated and 03's lane; and `C:/po-worktrees/pr1823`, which
is the head branch of `#1823`, **still OPEN**. Named again so no later run reads "orphaned" as
"deletable".

## WHAT CHANGED

Everything below happened in a **disposable worktree** off `origin/main`
(`C:\po-wt\st00-1208`, branch `docs/st00-1208-collect`, clean at `e4ecd9a5`), never in the dev tree
and never in the watcher clone. **This breadcrumb was written INSIDE that worktree** — cure 1 of the
station doc's post-merge rule — so no loose untracked copy exists in the dev tree to block the next
fast-forward.

1. **Two collected breadcrumbs `git mv`-ed to `docs/pr-prompts/archive/`** — the 11:40Z run and its
   11:55Z addendum. Every finding in both now carries a disposition, below. Checked against the
   **tracked set** and not the dev tree first: `git ls-files docs/pr-prompts` matched both basenames
   (POSITIVE control, the 10:10Z breadcrumb → 1; NEGATIVE, a minted needle → 0), so both had already
   reached everyone via `#1848`/`#1849` and neither needed re-committing at the root path.
2. **This breadcrumb.**

Nothing was armed, disarmed, merged, labelled, rebased, closed or restarted. No `/sot/` edit. No
production data. No Azure, Entra or SharePoint. No `git` from the VM against the mount.

Outside the PR, both appends to existing **gitignored** escalations rather than new filings:
`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md` (F2)
and `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` (F4). Scratch scripts under
`C:\po-sup-fix-scripts\` — outside the repo.

## FINDINGS

### F1 — The second actor's arm became `#1850`, the fourth PR waiting on Marco, exactly as predicted twelve minutes earlier. S3 (collect).

The 11:55Z addendum recorded a second actor — `actor=station-00.cowork-audit`, a **new** actor string
on this board — arming `pr-triage-corpus-suffix-union` at **11:50:44Z**, nine minutes after that
run's own sweep had certified single-actor. It predicted, from the prompt's `scope:` alone: *"its
`scope:` is `scripts/pipeline/triage-holds.ps1`, outside `tests|docs`, so `classifyPolicyFiles` will
route its PR to Marco and it becomes the **fourth** PR waiting on him."*

[MEASURED] this run: the watcher opened **`#1850`** at **12:02:05Z** — 15 seconds after that
addendum's last write — and the verdict in
`processed/pr-triage-corpus-suffix-union-ready.md.log` reads
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}`.
**The predicted reason string is the measured reason string, verbatim.** The prediction is now a
measurement, which is the only thing that makes the addendum's F1 checkable rather than an opinion.

Two things worth carrying, and neither is a new escalation:

- **The retirement worked.** `#1849` retired the consumed `-HOLD.md`, and
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` now returns **no** match for
  `triage-corpus-suffix-union`. The depth-1 HOLD count fell 41 → **40** and `triage-holds.ps1`'s
  gates-satisfied bucket fell 10 → **9**. So for this prompt the stays-armable-forever defect is
  closed, by the one move that closes it. The **general** defect is untouched.
- **The arm was sound and I am not reversing it either.** It linted ADMIT, its gates were met, and it
  was on the previous run's own candidate list. What it was not is free.

**ACTIONED** — verified live rather than read from the breadcrumb, and the addendum's ESCALATED
disposition on the underlying second-actor question stands unchanged. The narrow question that is
Marco's alone remains open and is not re-asked here: **is `station-00.cowork-audit` yours?**

### F2 — The occurrence gap re-measured independently, and the mechanism is sharper than "three runs never fired". S2.

The 11:40Z run escalated that three consecutive 00 occurrences never fired because its own
predecessor ran 3 h 31 m. I re-derived the session-directory table from scratch rather than quoting
it, and it reproduces — **with a refinement that changes what the fix has to do.**

[MEASURED] 12:1xZ, 14 session directories created today, grouped by `CreationTimeUtc`:

| 00 occurrence due | session directory | duration |
|---|---|---|
| 00:08 … 07:08 (eight runs) | all present | 18–35 min each |
| **08:08** | `local_2e0fdd10` created `08:08:07Z`, last write `11:39:52Z` | **3 h 31 m** |
| **09:08** | **ABSENT** | never fired |
| **10:08** | **ABSENT** | never fired |
| **11:08** | **ABSENT** | never fired |
| 11:40 (off-cron) | `local_ece458fc` `11:40:17Z` → `12:01:47Z` | 21.5 min |
| 12:08 | `local_bab9ff81` `12:08:09Z` | this run |

**POSITIVE control:** `04-scanner`'s three directories (`02:10:29Z`, `06:09:45Z`, `10:09:47Z`) are
all on disk, so an absent directory is a real absence and not retention.

**The refinement, and it is two separate observations:**

1. **The 11:08 slot was not lost the way 09:08 and 10:08 were — it was DEFERRED.** The 11:40 fire
   began **25 seconds** after the long run's last write, off a `5 * * * *` cron. Two occurrences were
   destroyed outright; the third appears to have been held and released the moment the previous
   instance freed up. "Three never fired" is literally true of the three cron slots and slightly
   overstates the loss: coverage lost is ~3.5 h, not 3 h of slots plus a fourth.
2. **A 21.5-minute run that ENDS before the next slot does not eat it.** The 11:40 run finished at
   `12:01:47Z`; the 12:05 occurrence fired normally at `12:08:09Z` — me. So the trigger is not
   "a long run" but **"a run still live when the next occurrence comes due"**, and today's second
   run never tested it.

This matters for the fix rather than for the diagnosis. A wall-clock budget only has to guarantee a
run **ends** before its successor is due — it does not have to be short — and the deferral behaviour
means the cost of a small overrun is latency, not a lost slot. It also means the escalation's own
falsifying probe was **not** satisfied today: no run overran its slot and saw the next directory
present anyway, so nothing here refutes the filing.

**ESCALATED** — appended to the live
`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md`, not
filed anew. Re-raising a live filing splits its evidence, which is the failure this pipeline keeps
paying for. Its option (a) — `CADENCE['00'] = 1` plus a wall-clock budget, together — is unchanged
and remains complete-and-additive; this run only sharpens what the budget must guarantee. **The
falsifying probe is the table above:** group the session directories by `CreationTimeUtc` and cross
them against 00's cron. **This run cost nothing** — 12:08 fired on time.

### F3 — Every armable prompt and every open PR is Marco's, and the count went UP this hour. S3.

Both halves measured this run, not quoted: **4 of 4 open PRs carry a live `marco:true` verdict**, and
**0 of 9 gate-satisfied HOLDs is `tests-docs` eligible**. The `tests-docs` lane is not broken — it has
merged 48 PRs with no human and its `ok:true` count is re-measurable — it is **starved of eligible
work**, because everything left in the queue touches `apps/`, `scripts/`, `.github/` or `migrations/`.

The previous run declined to arm on exactly this arithmetic, at 3 PRs. It is now **4**, the oldest
having waited **36.2 hours** — and the fourth was added by a different actor ten minutes after that
decision was written. That is the second-actor problem stated in its cheapest form: **two actors
cannot hold one throughput policy between them**, and the one that arms need not have read the policy.

**DEFERRED — I armed nothing, deliberately.** `arm-prompt.ps1` was not called, so `.arming-log.txt`
is untouched by this run. What would reverse this, and it is a different trigger from "the queue is
long": a gate-satisfied HOLD appearing that IS `tests-docs` eligible — arm it immediately, that one
costs Marco nothing — or an open PR blocking a `requires_merged` chain behind it, which none of these
four does.

### F4 — The Cowork VM mount has now failed on every station run today, and its falsifying probe fired again. S3.

`vm-git-guard.sh` could not be installed because the Linux workspace itself failed to mount
(`Plan9 share "c" which is not mounted`). This is the **fourth consecutive run** to quote that same
last line: Station 04 at 10:1xZ, Station 00 at 11:4xZ, and this run at 12:0xZ, against a filing
already titled "two-stations".

The live escalation
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` names its own discharge
condition: *"Next scheduled run of any station: if [the installer] returns an installer line rather
than an RPC mount error, this escalation is discharged."* **I ran that probe and it returned the RPC
mount error, so the escalation is NOT discharged** — it is confirmed for a further run.

The consequence is bounded and worth stating precisely so no later run over-reads it: the guard
exists to stop a VM-side `git` call wedging the Windows `.git`, and **a transport that cannot start
cannot make that call**. So today the missing guard costs nothing operationally. What it costs is a
*blind* run's COLLECT — the mount is how a blind run reads the queue, the RULE 2 logs and the three
binding documents — and a blind run that also cannot mount can do neither, which is a strictly worse
failure than either alone. That compound exposure is already named in the filing's point 3.

**ESCALATED** — one line appended to the existing filing with this run's timestamp. Not re-filed, and
deliberately not renamed to correct "two-stations": renaming splits the evidence trail for a
cosmetic gain. **What only Marco can answer** is unchanged and is on the file: whether the Plan9
share failing is something visible on the machine, and whether a restart clears it. No agent can
measure that from inside a session that has already failed to mount.

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs carry a live watcher `marco:true` verdict, and
  section 10.1 step 1 runs first and wins. Their being unlabelled changes nothing — removing
  `do-not-merge` does not clear RULE 2, and only Marco clears it, in chat, for that batch. `#1823`
  additionally carries its own receipt at `docs/decisions/merge-approvals/1823.md` inside its own
  diff; that is the known CP-26-armed-by-labelling hole, it is already escalated, and it is **not** a
  release.
- **Did not read the CP-26 pass/fail counts as work.** A PR carrying `do-not-merge` shows two reds
  from one cause and is parked by design; the discriminator is the verdict TOKEN in column 3 of the
  job log, not the counts. No open PR needed that read this run — none is labelled — and I did not
  manufacture one.
- **Did not arm.** F3 gives the reason and the trigger that would reverse it.
- **Did not reverse, disarm or rename the second actor's arm**, or `#1850`. The arm was valid;
  undoing another actor's sound work because I did not authorise it is not my call and would discard
  work Marco may have asked for.
- **Did not restart, kill or investigate the watcher.** Node RUNNING pid 18228, wrapper alive,
  heartbeat 0 min, empty queue — that is *idle*, and `restart-watcher-if-wedged.ps1` was neither
  needed nor run. "Cannot verify" is never "down", and a false emergency licenses destructive action.
- **Did not chase `BEHIND` on `#1850` or `#1832`.** BEHIND is a rebase, not a failure, and the
  known post-merge `pollForBehindPrs` pass rebuilds every open PR ~3.5 min after each board merge —
  which two merges at 11:55Z and 12:00Z fully explain. Already escalated; not re-raised.
- **Did not treat main as red.** Three completed runs on the full SHA are `success` and the fourth is
  still `in_progress`. "Not yet green" and "failing" are different readings and only one of them is
  a defect.
- **Did not prune either worktree.** `C:/po-vg` holds an uncommitted file and is already escalated
  (03's lane); `C:/po-worktrees/pr1823` belongs to an OPEN PR. A `--force` prune would discard real
  work.
- **Did not sweep the five untracked `docs/pr-reviews/pr-18xx-review.md` files or the three
  long-standing untracked queue-root files** (`.queue-sync-ledger.txt`, `queue-watch-state.md`,
  `archive/review-escalations-516-1346/`). None is a station breadcrumb, the review files are the
  review lane's own output in one of its three legitimate homes, and committing files whose
  provenance I have not established is how a duplicate lands.
- **Did not run `git` from the VM against the mount.** The transport was down all run, so the
  question never arose; the guard failure is quoted in the ground block and carried as F4 rather than
  treated as a stop, because widening the stop contract would turn a missing shell script into a
  frozen board.
- **Did not open a new `needs-marco/` file for F2 or F4.** Live filings already name both
  mechanisms; I appended the new measurements to them.
- **Did not re-raise** the `CADENCE['00']` row, the 00×04 cron collision (04 next fires `14:09:31Z`
  against 00's `14:07:52Z`, so it will recur at 14:0xZ exactly as predicted), the general
  stays-armable-forever defect, or the CP-26 hole. All are filed with stated triggers, and re-filing
  them costs the next run its collect.
- **Did not touch `/sot/`** (Station 05's, CP-24), **Azure, Entra or SharePoint** (absolute), or
  production data.
