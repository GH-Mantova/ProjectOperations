# Station 00 — Supervisor | 2026-09-11T03:09Z–2026-09-11T03:45Z

## GROUND

```
UTC            2026-09-11T03:09:20Z
origin/main    fd7234c6  (at start)  ->  5ce24471  (after merging #1873)
dev tree       main @ fd7234c6 -> 5ce24471   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1   (scheduled-task SKILL.md)   MATCH — full authority
```

Sighted run. `start_process` shell `powershell.exe` succeeded on the first call after a keyword
`ToolSearch` for `desktop-commander` (PID 33728). Desktop Commander **0.2.50**, client
`claude-code 2.1.266`, PS `5.1.26100.9444`, node `24.14.1`. All three binding documents read in
full from the dev tree at `fd7234c6`, which `git rev-parse --short origin/main` showed was
identical to `origin/main` at the moment of reading (no stale-tree risk).

**vm-git-guard: NOT INSTALLED — a FINDING, not a stop (F4).** The installer could not run: the
Linux workspace failed to start at all, with
`failed to mount … is under Plan9 share "c" which is not mounted` and the app's own note
*"A Windows update released September 8 prevents Claude's workspace from reaching your files."*
Quoted in full under WHAT I MEASURED. No VM-side `git` was attempted, so the guard's hazard
(a 0-byte `index.lock` with no owning Windows process) could not arise this run by construction.

## WHAT I MEASURED

**Sweep.** `status-sweep.ps1` captured to a file (it returns early and hides its own verdict),
written by `*>` and therefore UTF-16LE — decoded `utf16le` in node, 413 lines. [MEASURED]
Section 7: `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
worktrees.` Section 0 positive controls both passed (`gh CAN reach GitHub`, `node runs`).
Section 5 (stale-claim cross-check) printed **zero rows** — the eleven `[STALE]` escalation rows
the 09-10T21:1xZ run recorded are cleared and did not return.

**Board at 03:12Z.** 3 open: `#1874` BLOCKED (11 pass / 3 fail / 1 pending), `#1873` CLEAN green,
`#1865` dependabot (14 pass / 0 fail / 1 pending). `main` CI on `fd7234c6`: 3 success / 0 failed /
1 running.

**Watcher.** node RUNNING pid 29808, wrapper alive (1), heartbeat age 0 min, BUILD IN FLIGHT
`pr-qpdf-1-estimate-preview-mark-ready.md`. Armed: 1. HEALTHY — no restart considered.

**Clone-dirty `[LIVE]` line re-derived before acting, per §9.5's sweep-lines-are-not-exempt rule.**
The sweep printed `watcher clone: branch=main dirty=3  <-- … the watcher may refuse to start`.
[MEASURED] `git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no` →
**0**. This is the known false warning already recorded in DOCTRINE §9.5 (untracked review
verdicts the `rev-<N>` job writes into the clone by design). **NOT dispatched to 03** — dispatching
it is the mis-routing that bullet names.

**RULE 2 lane probe, live tree only (`C:\ProjectOperations2\docs\pr-prompts\processed`), never the
clone.** Newest log `pr-qpdf-1-estimate-preview-mark-ready.md.log` at `2026-09-11T03:15:23Z` —
younger than every open PR, which is the control that separates the live directory from the
seventeen-day-stale decoy. 2134 logs. POSITIVE control `marco.:true` (regex, no quote character) →
**631**. NEGATIVE controls: `PR #999321` → **0**; freshly minted needle `zzQq00Needle20260911T0320`
→ **0**.

| PR | `processed\pr-*.log` hits | lane |
|---|---|---|
| `#1873` | **0** | `[NO LANE VERDICT — hand-classified]` — all 9 files under `docs/`, and it is Station 00's own board PR (§10.1 step 3, authority matrix). NOT Marco's. |
| `#1874` | **2** | watcher-opened. Verdict: `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` ⇒ **RULE 2 binds.** |
| `#1865` | **0** | `[NO LANE VERDICT — hand-classified]` — dependabot, touches lockfiles, outside all three `NESTED_TEST_PATHS` forms ⇒ **Marco's.** |

**Cross-check against the prose-scrape trap landed 90 minutes ago (§10.1, `PRNUMBER_SCRAPED_FROM_PROSE_V1`).**
`#1874`'s verdict is trustworthy: the log that carries it is
`pr-company-manage-s1-permission-and-grant-ready.md.log`, and that same log carries that prompt's
own `PR #1874 opened for SLICE 17 slice 1` line for the **same** number. Not a scrape.

**`#1874`'s three reds, named rather than counted.** `Approval receipt (CP-26)` and
`PR gates — diff checks` are the **one cause, two reds** pair DOCTRINE §9.4 records for a PR
carrying `do-not-merge` — parked by design, no agent-side action. The third,
`API — lint, test, compliance smoke` (3m53s, job `103131327144`), is a **real red** and is mine
under the ACTIVE DRIVE MANDATE. Not diagnosed this run — see WHAT I DID NOT DO.

**Station 04's F2 re-measured before editing anything, as its dispatch required.** Through
`start_process` with `-Command` — the transport §9.1 names, and never `-File`:

| probe | §9.1 documented | Station 04, 02:2xZ | this run, 03:2xZ |
|---|---|---|---|
| `$CTRL=42` (undefined at expansion time) | arrives as bare `=42` | `CTRL-literal-is:42` | **arrives as bare `=42`**, `You must provide a value expression following the '+' operator` |
| `$true` | `True` | `True` | **`True`** |

**The trap REPRODUCED.** So F2's premise does not hold at DC `0.2.50` / PS `5.1.26100.9444`, and
the §9.1 expansion bullet stands **unqualified and unedited**. Two runs of the same station family,
seventy minutes apart, on one machine, got opposite answers from the control the bullet mandates;
the discriminator is **[CANNOT MEASURE]** this run — the obvious candidate is the exact quoting of
the `-Command` argument as it leaves the caller, and I did not capture 04's literal argument.

**Breadcrumb freshness.** `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0; 00 `1.1h ago ok`,
03 `4.1h ago ok`, 04 `1.1h ago ok`, 05 `13.1h ago ok`. ⚠️ It reported 00 fresh from a breadcrumb
that was **not on `origin/main`** — that is not a defect: the script reads open-PR file lists via
`gh pr list --json files` on purpose (its own comment at the `gh pr list` call site says so).
Crossed against the scheduled-tasks layer by the board itself: 00 ran at 02:0xZ (its PR `#1873`
created 02:37Z) and 04 at 02:11Z, both consistent.

## WHAT CHANGED

**1. Merged `#1873`** — the previous run's collect PR, which carried Station 04's 02:11Z breadcrumb
and my own 02:09Z one. `Assert-SmokedOrEscalate -PR 1873` → `True`, exit 0; `Merge-Pr -PR 1873` →
`True`, exit 0. Read back with `--json` and `ConvertFrom-Json` (never `--jq` from PS 5.1):
`state=MERGED mergedAt=2026-09-11T03:16:09Z`. `origin/main` `fd7234c6` → **`5ce24471`**, and both
breadcrumbs confirmed present via `git ls-tree -r --name-only origin/main`.

**2. Fast-forwarded the dev tree, and the append-only cure was load-bearing.** Three blockers in
sequence, exactly as the station doc predicts. (a) The untracked root copy of 04's breadcrumb:
`git rev-parse origin/main:<path>` = `git hash-object <path>` = `b2ffb603` — byte-identical, so
deleted. (b) `sweep-rotation.json` and `.arming-log.txt` restored to **HEAD** with
`git show HEAD:<path>` piped to a node write (never `git checkout -- <path>`). (c) The FF still
refused; `git add --renormalize` staged `.arming-log.txt` **`M`**, which is the documented
CRLF-blob-vs-`text: auto` artefact and **not** a content difference — cured with
`git restore --staged`, after which `--cached` was EMPTY. FF then clean. Read backs, all three:
`git rev-list --left-right --count HEAD...origin/main` → `0	0`; `git diff --cached --name-status`
→ EMPTY; `git diff --numstat` → only the two consumed-HOLD deletions discussed in F3.

🔴 **The save/restore/FF/REAPPLY rule saved one line of an append-only audit log.**
`.arming-log.txt` was a strict superset of `main` (`git diff --numstat origin/main` → `1  0`,
insertions with zero deletions — the discriminator). The extra line is
`2026-09-11T03:02:53Z  ARMED  pr-qpdf-1-estimate-preview-mark  escalates=true
actor=station-00.cowork-0002  by=Marco@LAPTOP-E6NHU4E4  pid=26280`. It was backed up before the
restore and reapplied after the FF: local **11999 B** → HEAD 11825 B → FF → reapply → **11999 B**,
`missing_lines=1`, arm present in the result. Restoring to HEAD without the reapply would have
deleted another actor's arm record irrecoverably, and every prescribed read-back would still have
passed.

**3. Landed Station 04's F1 in `DOCTRINE §9.1`** (this PR). Edited with node by **concatenation**,
never a `String.replace` replacement string. Byte delta asserted: before 184008, after 185634,
expected 185634, `DELTA_OK=true`, `old_gone=true`, `new_present=true`, negative control absent.
`git diff --numstat` → `22  4` on one file, which matches the intended change and proves nothing
spilled. Canonical hash re-recorded: `lint-station.mjs` → `REJECT: 1 of 8` (confirming §9.5's note
that an `instruments v2` edit costs ONE document, not seven), then `--write-canonical` →
`instruments v2 e4a985004eb57df1`, then a clean re-lint → `ADMIT: all 8 docs clean`, exit 0.

**4. Published the concurrent lane's arm.** `.arming-log.txt` copied into this PR so the 03:02:53Z
arm reaches `origin/main`; nothing commits that file on purpose, so it closes and re-opens by luck.

**Nothing else was mutated.** No prompt armed, no label touched, no watcher restarted, no worktree
pruned, no `git` run in `C:\po-watcher\ProjectOperations`.

## FINDINGS

### F1 — Station 04's F1 (the fixture that cannot fail) — LANDED

04 measured that `DOCTRINE §9.1`'s 2026-09-10 wildcard correction nominates a falsifying probe
whose fixture B returns exactly the values named as its own refutation, because the mechanism needs
**zero files of any kind** at depth 1, not zero *matching* files. Verified against the live text
before editing: the spec read *"`.log` files only deeper, none at depth 1"*, and the bullet's own
worked table names a directory holding *"7 subdirectories and 0 files"* — 04's fixture C shape.
The two are inconsistent on their face, so this needed no re-measurement of 04's fixtures to act on.

**ACTIONED** — fixture B's row and spec now read **ZERO FILES OF ANY KIND at depth 1**, with a
dated correction clause carrying 04's three-fixture table, and the closing sentence reworded so the
probe can fail. Verified: byte delta asserted, `22  4` numstat, `lint-station.mjs` ADMIT 8/8 exit 0
after `--write-canonical`. Nothing retired — the RULE (bare directory + `-Filter` with `-Recurse`)
is untouched.

### F2 — Station 04's F2 (the expansion trap "stopped reproducing") — REFUTED, no edit made

04 dispatched a request to qualify §9.1's `$`-expansion bullet with a dated non-reproduction, and
explicitly required *"re-run both rows before editing anything"*. I did, through the transport the
bullet names. **The trap reproduced**: `$CTRL=42` arrived as a bare `=42` and `$true` as `True`,
at DC `0.2.50` / PS `5.1.26100.9444` / claude-code `2.1.266`. Qualifying an unqualified §9 bullet
on a non-reproduction I cannot reproduce would weaken the one instrument that catches a silent
wrong value at exit 0 — the worst shape in §9, and the half of RULE 1 about not damaging future
work.

**ACTIONED** — no edit; the bullet stands unqualified, which is what the re-measurement supports.
⚠️ What is genuinely open is the DISAGREEMENT, not the bullet: two runs, one machine, seventy
minutes apart, opposite answers from the mandated control. The discriminator is
**[CANNOT MEASURE]** here because 04's literal `-Command` argument was not captured. 🔧 **For the
next `instrument-honesty` sweep: quote the exact argument string you sent, verbatim, alongside the
result** — without it a reproduction and a non-reproduction are indistinguishable reports, and this
pair is the proof.

### F3 — Two consumed prompts are still tracked on `main`, and retiring them now could lose live work

[MEASURED] after the FF, `git diff --numstat` in the dev tree shows exactly two deletions:
`pr-company-manage-s1-permission-and-grant-HOLD.md` (137 lines) and
`pr-qpdf-1-estimate-preview-mark-HOLD.md` (204). Both were armed and consumed — the first opened
`#1874`, the second is **building right now** — so both are instances of the stays-armable-forever
defect this pipeline already records. The obvious move is to sweep them into `superseded/` in this
PR, which is what `#1873` did for `pr-scopecards-s0-plan-HOLD.md`.

🔴 **I did not, and the reason is RULE 1's second half.** `#1874` is OPEN and waiting on Marco, and
`pr-qpdf-1`'s build was in flight at the moment of writing. Retiring a prompt whose PR may yet be
closed unmerged removes the queue's only live copy of that work at the moment it is most likely to
be needed. Neither deletion blocks anything: a ` D` against a tracked file does not refuse a
fast-forward, and the dev tree is otherwise at `0 0` / EMPTY / EMPTY.

**DEFERRED** — this becomes urgent the moment either settles. Sweep
`pr-company-manage-s1-permission-and-grant-HOLD.md` into `superseded/` once `#1874` MERGES (not
before), and `pr-qpdf-1-estimate-preview-mark-HOLD.md` once its build's PR merges. If either PR is
closed UNMERGED instead, the prompt must stay and be re-armed, which is precisely what retiring it
now would have prevented.

### F4 — The Linux workspace cannot mount at all, so `vm-git-guard.sh` could not be installed

[MEASURED] 2026-09-11T03:1xZ. `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
never reached the script: the workspace itself failed to start, with
`resume: RPC error -1: failed to mount … as .auto-memory: source path … is under Plan9 share "c"
which is not mounted`, and the harness's own note *"A Windows update released September 8 prevents
Claude's workspace from reaching your files."* PREFLIGHT is explicit that a failed install is a
FINDING and not a stop, and that widening the stop contract here would turn a missing shell script
into a frozen board.

⚠️ **The consequence cuts the safe way this run and the dangerous way on a blind one.** With no VM,
no VM-side `git` can run, so the 0-byte-`index.lock` hazard the guard exists to prevent could not
occur — I was never exposed. But `STATION-CAPABILITIES.md` §3 names the mount as the transport that
gives a **blind** run its whole COLLECT, and it has now been unavailable across several consecutive
station runs. The documented fallback is the Cowork native file tools
(`NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`), which is why this is not an escalation.

**DEFERRED** — it costs a sighted run nothing, and the fallback is recorded. It becomes urgent if a
blind run reports it could not COLLECT; at that point the question of whether the workspace mount is
ever coming back is Marco's, not a station's, because its cause is a Windows update outside this
repo.

### F5 — A concurrent Station 00 lane armed a prompt mid-cycle, for the second hour running

[MEASURED] `.arming-log.txt` carried one line absent from `origin/main`:
`2026-09-11T03:02:53Z ARMED pr-qpdf-1-estimate-preview-mark … actor=station-00.cowork-0002
pid=26280`. That is **seven minutes before this run started** and by an actor that is not this
session. The previous run's breadcrumb records the same shape an hour earlier
(*"a concurrent lane armed thirty seconds after the merge"*). Two things follow and both are
already on file rather than new: two Station 00s can drive one board with nothing guarding it
(open escalation #23), and the arm reached `origin/main` only because this run happened to sweep
the log into its PR.

**DEFERRED** — no new escalation. #23 is live and names this exact failure, and filing a second
document for it fragments the record Marco has to read. ⚠️ What this run adds to it as evidence:
the collision is now **recurring hourly**, not occasional, and the arming log is the only instrument
that sees it — `status-sweep.ps1` reported `armed: 1` with no indication of who armed it.

### F6 — Station 04's F3 (the CADENCE map) — already filed with Marco, nothing for me to add

04 re-measured `check-breadcrumb.mjs`'s `const CADENCE = { '00': 2, … }` against 00's live cron
`5 * * * *` and confirmed the one-character fix has still not landed, six days after filing. I did
not re-run the probe: it is a `scripts/` change, outside Station 00's merge lane, and it has a live
home at `needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`. Confirmed
this run that the consequence is real and benign today — `--freshness` read 00 as `ok` from a
breadcrumb that was only on an open PR, and the cross-check against the board caught it either way.

**DEFERRED** — correctly escalated already, and re-raising it adds noise to a queue of 51 files.
It becomes urgent the moment 00 misses a run *and* nothing else notices, which is the failure #23
describes; the mitigation until then is the one the COLLECT step already mandates, crossing
`--freshness` against the scheduled-tasks layer rather than trusting `ok`.

## WHAT I DID NOT DO

**I did not diagnose `#1874`'s `API — lint, test, compliance smoke` red.** It is a real red and it
is mine under the ACTIVE DRIVE MANDATE — RULE 2 forbids me from MERGING that PR, not from fixing
it. I stopped because the merge, the fast-forward and the F1 landing consumed this cycle honestly,
and §3 forbids diagnosing a CI failure from anything but the job log, which is 220-ish tab-separated
lines needing the column-3 split §9.1 prescribes. Starting that at the end of a cycle risks a
half-diagnosis, which is worse than none. 🔧 **Next run: `gh run view 34556873130 --job
103131327144 --log`, split on the tab, read the LAST column** — grepping the whole line matches
every row, because column 1 is the job name. The two CP-26 reds on the same PR are parked by design
and need nothing.

**I did not retire the two consumed HOLDs** — F3, and the reason is that one PR is open and one
build was in flight.

**I did not touch `#1865`.** Dependabot, second lane, hand-classified Marco's under §10.1 step 2
(lockfile paths are outside all three `NESTED_TEST_PATHS` forms). It had 1 check still running.

**I did not arm anything.** One prompt is already armed and building; `ARM ONE AT A TIME` is the
rule, and the queue census (`armed: 1`) is the instrument. The `READY TO STAGE` backlog item
`rates-11c-blocked-consumers` remains staged-not-armed by design — it is gated on a parity proof
that must have RUN clean, and existing is not passing.

**I did not prune the worktrees the sweep flagged** — `C:/po-vg` (age 9797 min, **holds 1
uncommitted file**), `C:/po-worktrees/pr1823` (dirty=0, age 1739 min), and the registry escapee
`C:\po-worktrees\v1823`. Worktrees are Station 03's, `C:/po-vg` is already escalated, and
`--force` on a worktree holding uncommitted work is irreversible (§5.4).

**I did not dispatch the clone-dirty warning to Station 03.** Re-derived it first and it is the
known false positive DOCTRINE §9.5 records; dispatching it is the documented mis-routing.

**I did not restart or touch the watcher.** HEALTHY on every signal — node running, wrapper alive,
heartbeat 0 min, queue moving.

**I did not edit `/sot/`, touch Azure / Entra / SharePoint, write production data, remove a label,
or run `git` in the watcher's repo.**

**This breadcrumb was written inside this run's PR worktree** (`C:\po-wt\bd0311`), which is cure 1
of the station doc's post-merge cleanup rule — so no untracked copy is left in the dev tree and the
next fast-forward cannot be blocked by it.
