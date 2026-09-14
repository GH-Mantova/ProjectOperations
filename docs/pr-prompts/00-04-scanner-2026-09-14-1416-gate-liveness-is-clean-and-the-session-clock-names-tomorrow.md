# Station 04 — Scanner | 2026-09-14T14:10Z–2026-09-14T14:25Z

## GROUND

```
UTC            2026-09-14T14:10Z
origin/main    ed3e5e42            (fetched first, then rev-parse)
dev tree       main @ ed3e5e42      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (1 = 1), so this run was not restricted to read-only by the
version check. It was read-only anyway: 04 is read-only on the board by authority.

SIGHTED run. `start_process` shell `powershell.exe` returned PID 30648 at 14:10Z on the first
call, after a keyword `ToolSearch` for `desktop-commander` — schemas arrive deferred and a cold
call is an unloaded schema, not blindness.

Binding documents read this run: `docs/pipeline/stations/04-scanner.md` (515 lines, in full),
`docs/pipeline/DOCTRINE.md` §§1–8, §9.1–9.6, §10.1 and its section index,
`docs/pipeline/STATION-CAPABILITIES.md` §§2–4. [MEASURED] all three read from the working copy
after proving the working copy IS `origin/main` for them:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, which per §9.2 is the real answer. No
piped hash was taken and none is quoted (§9.1, the piped form is unsound in `powershell.exe`).

</content-note: sweep this run = gate-liveness, rotation position 1 of 4>

## WHAT I MEASURED

**Device-bridge git guard — [CANNOT MEASURE], the transport is gone.** PREFLIGHT step 1 requires
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` and requires its last line
quoted pass or fail. It could not run. Quoted verbatim, both attempts identical:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
/mnt/.virtiofs-root/shared/c/.../ProjectOperations2 ... is under Plan9 share "c" which is not
mounted; create: RPC error -1: ensure user: user tender-upbeat-hawking already exists
unexpectedly (attempt 2 of 5 since last success)
A Windows update released September 8 prevents Claude's workspace from reaching your files.
```

Two honest attempts, byte-identical failure, so this is [CANNOT MEASURE] and not a retry loop.
A failed install is a FINDING, not a STOP (station-contract v3), and the run continued. **The
guard's absence cost nothing this run because the transport it guards is the same transport that
is down:** no VM-side `git` against the mount was possible, so the 0-byte-`index.lock` hazard
the guard exists to remove could not arise. See F1.

**Sweep selection.** `node scripts/pipeline/next-sweep.mjs` → `SWEEP: gate-liveness`, rotation
position 1 of 4, previous run `2026-09-14T10:10:03Z` (04's cadence is 4h; this run is on time).
Advanced at the end with the timestamp measured here — see WHAT CHANGED.

**Board, from `status-sweep.ps1`, captured to a file and decoded `utf16le` in node** (§9.3 — `*>`
is the same UTF-16LE trap as `>`, and the script returns early and hides its own §7 verdict
otherwise). `SWEEP COMPLETE 2026-09-14 14:11:20Z`. §0 instrument controls both **[LIVE] PASS**.
§7 verdict: **`SAFE TO ACT`**. [LIVE] lines only:

- OPEN PRs **2** — `#1923` CLEAN, CI 15/0/0 green · `#1920` BLOCKED, CI 13 pass / **2 fail**.
- main CI on `ed3e5e42`: 4 success / 0 failed (trunk green).
- watcher node RUNNING pid 30976; auto-restart wrapper alive; heartbeat 49 min (idle, empty queue).
- watcher clone `branch=main dirty=2` — NOT clean-on-main.
- three non-main worktrees, all classified orphaned: `C:/po-fix1891` (dirty=0, 776 min),
  `C:/PR-Master/worktrees/po-vg` (**dirty=1, 14778 min — HOLDS UNCOMMITTED WORK**),
  `C:/PR-Master/worktrees/pr1823` (dirty=0, 6720 min).
- queue: **armed 0** · needs-marco 53 · no-pr-opened 109 · failed 49 · blocked 135.
- backlog gates: ready=1 needs-marco=2 blocked=4 broken=0.

⚠️ Every count above is STATE. Re-measure; do not quote these numbers in a later run.

**THE SWEEP — gate liveness over the whole HOLD corpus.**
`Get-ChildItem docs\pr-prompts -Filter '*-HOLD.md' -File` → **36** at depth 1 (bare directory
plus `-Filter`, no trailing `\*`, per §9.1's corrected form; counted with a null guard per §9.4).

`scripts/pipeline/triage-holds.ps1` (read-only, `--dequeue` never passed), captured and decoded
the same way. **Its own two controls passed and they are what make the zero readable:**

```
GIT control:   PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (190960 chars)
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture
```

`git --version` 2.55.0.windows.3 at `C:\Program Files\Git\cmd\git.exe`; `gh version 2.90.0`.
§9.5 requires `git` to be proven resolvable before any ADMIT is trusted, and `gh` before any
`fixes_pr` verdict — both done.

```
TOTALS  spent=0 of 36 evaluated  gates-satisfied=3  still-gated=33  unreadable=0
        spent behind a REJECT: 0   still needed: 33   UNMEASURABLE: 0
        verdicts observed this run: ADMIT, REJECT (SPENT proved reachable by fixture)
```

GATES SATISFIED (ADMIT — candidates only, and 04 arms nothing):
`pr-crmvis-s0-visual-parity-tooling-HOLD.md` · `pr-ea-s2a-dashboard-preset-seed-HOLD.md` ·
`pr-fv2-import-s2-review-route-HOLD.md`.

**Second instrument, independent of `lint-prompt.mjs`** — `C:\po-sup-fix-scripts\gate-liveness-04.mjs`
(a prior 04 run's script, reused; it carries its own git positive/negative control, which passed:
known file ok=true 1930b, known-absent ok=false). Every `requires_*` gate on the 33 REJECTs
evaluated directly against `origin/main`:

| bucket | n | result |
|---|---|---|
| `requires_on_main` (needle form) | 13 | needle **absent** on all 13 → gate ALIVE |
| `requires_file_on_main` | 4 | file **absent** on all 4 → gate ALIVE |
| `HUMAN_GATE_PRESENT` / `UI_PROMPT_NEEDS_DESIGN_REF` | 16 | no dependency gate to evaluate |
| the 3 ADMITs | 3 | gate condition **met** — correctly released, not dead |

**[MEASURED] zero dead gates, and zero spent premises behind them.** Two instruments, opposite
constructions, same answer: `triage-holds` re-probed all 33 REJECT premises directly and found
0 spent; the gate walk found 0 gates whose host file was missing or whose condition had already
been met without the prompt releasing. Every `requires_on_main` host file resolved on
`origin/main` — none of the 13 returned "NOT on origin/main", which is the reading that would
mean a gate can never fire because its host was renamed away.

**The destructive-prompt protection is INTACT, which is the specific thing this sweep's brief
tells me to check before repairing anything.** `git ls-tree -r --name-only origin/main --
docs/approvals/` returns exactly **two** files: `README.md` and
`watcher-identity-approved-by-marco.md` (POSITIVE control, `docs/pipeline/` → `ARMING.md`,
`DOCTRINE.md`, `LESSONS.yaml`). Neither destructive prompt's approval marker exists:

- `pr-rates-s11c-drop-legacy-tables-HOLD.md` → `requires_file_on_main:
  docs/approvals/rates-s11c-drop-legacy-tables-approved-by-marco.md` — **ABSENT, gate alive.**
- `pr-tenant-mt4-s2-ownership-migration-HOLD.md` → `requires_file_on_main:
  docs/approvals/tenant-mt4-s2-ownership-migration-approved-by-marco.md` — **ABSENT, gate alive.**
- `pr-524-rates-b-slice2-canonical-HOLD.md` (the third table-dropper) rejects on
  `HUMAN_GATE_PRESENT`, a stronger gate than a dependency. **Nothing was repaired. REPAIRED NOTHING
  is the correct outcome here and the brief says so explicitly.**

**Every-cycle checks.** `check-lessons.mjs` → `holding=5 regressed=0 broken=0`, exit 0.
`check-escalations.mjs` → `open=0 resolved=3 broken=0`, exit 0 — the three registered escalations
(`clients-perms-namespace`, `smoke-gate-nonfunctional`, `queue-armed-by-commit-noop`) all verified
on main. `check-backlog` ran inside the sweep (§6): `ready=1` — `rates-11c-blocked-consumers`.

**Clocks, three of them, because one disagreed with the session.**

```
HOST_UTC    = 2026-09-14T14:16:50Z
HOST_LOCAL  = 2026-09-15T00:16:50   TZ = E. Australia Standard Time (UTC+10)
git log -1 origin/main --date=iso-strict  →  2026-09-14T23:20:46+10:00  (= 13:20Z)
status-sweep self-stamp                   →  2026-09-14 14:11:20Z
this Cowork session's declared date       →  2026-09-15
```

The session's date is the **Brisbane local date**, ten hours ahead of the UTC date the whole
pipeline stamps with. See F2.

**Breadcrumb filename-vs-GROUND audit** (`C:\po-sup-fix-scripts\breadcrumb-date-audit-04.mjs`,
read-only, over `origin/main`): corpus **469** tracked breadcrumbs (POSITIVE control: 1192 tracked
files under `docs/pr-prompts/`); 435 carried a parseable `UTC` GROUND line; 34 did not; **1**
filename/GROUND date mismatch. That one is a **FALSE POSITIVE OF MY OWN PROBE** and is recorded as
such —
`archive/00-00-supervisor-2026-09-13-0900-two-verdicts-were-wrong-and-a-status-line-is-a-gate.md`
is a multi-day interactive segment whose GROUND reads
`UTC 2026-09-11T03:20Z … → 2026-09-13T09:xxZ`; the filename is stamped at the segment's END and my
regex reads the START. **Corrected count: 0 real mismatches in 435.** Quoting the raw `1` would
have manufactured a finding against a correct breadcrumb.

## WHAT CHANGED

`docs/pipeline/sweep-rotation.json` — advanced, **LEFT DIRTY IN THE DEV TREE**:
`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-14T14:16:50Z` →
`advanced: last_index=0 last_run_utc=2026-09-14T14:16:50Z`, exit 0. Read back:
`git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2`.
🔴 **Station 00 must commit this file with the next board PR. 04 may not commit to the shared dev
tree** (authority matrix: *Create a PR: NO*, *Mutate the board: NO*). If it is not committed the
rotation silently stops and the next run repeats gate-liveness.

Nothing else changed. No prompt was armed, disarmed, renamed, moved, staged or deleted. No PR was
touched. No label was changed. Nothing was merged. Two scratch `.mjs` files were written under
`C:\po-sup-fix-scripts\` (outside the repo, untracked by construction) and one report capture under
the same root.

## FINDINGS

### F1 — PREFLIGHT step 1 mandates a guard install on a transport that has been dead for days, and the instruction sits inside a hash-gated canonical block

`station-contract v3` — byte-identical in all seven station docs — orders every station to run
`vm-git-guard.sh` through the Linux workspace *first, before any VM-side call*, and to quote its
last line pass or fail. [MEASURED] 2026-09-14T14:1xZ, two attempts: the workspace cannot be
created or resumed at all; the Plan9 share `"c"` is not mounted, and the error names *"A Windows
update released September 8"*. [INFERRED] from `STATION-CAPABILITIES.md` §3, which records the
share *"unmounted for the fifth consecutive station run"* as of 2026-09-10T18:0xZ: this is the
same outage, now in its second week.

**Why it is worth a finding rather than a shrug.** The step is not merely failing — it is
*unreachable*, and the contract asks for a quoted last line that does not exist. A station reading
the block literally has three bad options and the contract names only one of them. More
importantly the block's own reasoning has quietly inverted: the guard exists because a cut-short
VM-side `git` leaves a 0-byte `index.lock` with no Windows process. **With the VM gone, no station
can run VM-side `git` at all, so the hazard is currently unreachable too.** The guard is protecting
against a thing that cannot presently happen, via a transport that cannot presently run.

**The cost is not zero, and it is the reason to raise it.** `STATION-CAPABILITIES.md` §3 also names
the mount as the transport that gives a *blind* run its whole COLLECT — the queue,
`docs/pr-prompts/processed/*.log` (the RULE 2 probe), `.arming-log.txt`, `verdicts-archive`, and
the ten other mounts. That is gone for blind runs as well; only the native file tools remain, and
they cannot honour PREFLIGHT step 2's *"read from `git show origin/main:<path>`"*. A blind run
today is materially poorer than the document describes.

⚠️ **[CANNOT MEASURE] whether the outage is host-wide or session-specific** — I have one session.
**Falsifying probe:** call `bash` with `date -u` from any station run; if it returns, this finding
is stale and must be re-measured.

🔴 **This must not be "fixed" by widening the STOP.** A missing shell script freezing the board is
the exact outcome the guard exists to remove, and the contract already says so.

**DISPATCHED → Station 00.** Two things only 00 can do: (a) decide whether the canonical block
should carry a *"if the workspace cannot start, record `[CANNOT MEASURE]` and continue"* clause —
which it arguably already implies but does not spell out — noting that any edit re-records the
hash across **seven** documents (`station-contract v3` is the cross-doc block; `instruments v2` is
DOCTRINE-only and costs one); and (b) author a `needs-marco/` file, because the *subject* of this
finding is outside the repo — a Windows update on Marco's box — and an escalation whose subject is
outside the repo is escalated to nobody unless a file names it.

### F2 — this session's date is the Brisbane local date, so a breadcrumb named from it lands one day in the future for ten hours of every day

[MEASURED] at the same instant: `(Get-Date).ToUniversalTime()` = **2026-09-14T14:16:50Z**;
`(Get-Date)` = **2026-09-15T00:16:50**, `TZ = E. Australia Standard Time`; and this Cowork
session's declared date is **2026-09-15**. Two independent host-side witnesses agree with UTC:
`status-sweep.ps1` self-stamped `2026-09-14 14:11:20Z`, and `git log -1 origin/main` reads
`2026-09-14T23:20:46+10:00`. **This is not a clock fault. It is UTC-vs-Brisbane, the same +10
offset DOCTRINE §3 already warns about for watcher logs, arriving in a new place: the session's
own notion of "today".**

**The hazard is specific and checkable.** The REPORT CONTRACT filename is
`docs/pr-prompts/00-<NN>-<station>-<YYYY-MM-DD>-<HHMM>-<slug>.md` and the GROUND block is UTC. An
agent that takes the date from the session and the time from the host produces
`2026-09-15-1416` — a filename one day ahead of the UTC timestamp printed inside it — for every
run between 14:00Z and 24:00Z, which is **ten of every twenty-four hours**, and 04's own 4-hourly
cadence puts two runs a day inside that window. The failure is silent: both halves are
well-formed, nothing is empty, and §9.6 cannot fire. It is §7's shape exactly — two correct
readings that were never measuring the same thing.

**It has not bitten yet, and I measured that rather than assuming it.** Over **435** tracked
breadcrumbs carrying a parseable GROUND `UTC` line (of 469 breadcrumbs; POSITIVE control 1192
tracked files under `docs/pr-prompts/`), filename date vs GROUND date mismatched **once**, and
that one is my own probe's false positive (a multi-day segment stamped at its end — see WHAT I
MEASURED). **0 real mismatches.** So this is a live hazard with a clean history, not a defect with
a backlog — which is the cheapest possible moment to write the rule down.

🔧 **The cure costs nothing and needs no canonical-block edit:** take the breadcrumb's date from
the same UTC reading that stamps GROUND, never from the session's declared date. This run did:
`HOST_UTC` → `2026-09-14`, and this file is named `2026-09-14-1416`.
⚠️ **Falsifying probe:** print `(Get-Date).ToUniversalTime()` and `(Get-Date)` in one call and
compare both against the session's declared date. If they ever agree during the 14:00Z–24:00Z
window, this finding is wrong and must be re-measured.

**DISPATCHED → Station 00**, as a one-line addition to the REPORT CONTRACT's filename sentence
(*"the `<YYYY-MM-DD>` is the UTC date from the same reading as GROUND, not the session's local
date"*). It is a one-document edit to the contract's prose and does **not** require re-recording
the `station-contract v3` hash unless 00 puts it inside the block — 00's call, and worth saying
out loud because "which layer" is what decides whether this costs one document or seven.

### F3 — gate liveness across all 36 HOLDs is clean, with controls; the corpus is genuinely idle, not unmeasured

spent=0 · gates-satisfied=3 · still-gated=33 · unreadable=0 · spent-behind-a-REJECT=0 ·
UNMEASURABLE=0. Both destructive-migration prompts' Marco-approval gates verified ABSENT on
`origin/main` and therefore ALIVE. Zero dead gates.

**The zero is readable because three separate controls passed:** `triage-holds`' SPENT fixture
(lint exit 3 proved reachable on a synthetic prompt), its GIT control (190,960 chars read from
`origin/main:DOCTRINE.md`), and the gate-walk script's own known-file / known-absent pair. Per
§9.6 an empty result is not an empty world — but a checked instrument that *can* say SPENT and
*did* say ADMIT three times, saying "none spent", is an empty world.

⚠️ **One thing the numbers do NOT say.** `armed=0` and `still-gated=33` mean the board has no work
it can start without a human. All three ADMITs are candidates only, and
`pr-ea-s2a-dashboard-preset-seed-HOLD.md` overlaps open PR **#1920** — triage flagged it and I
confirmed it: #1920's title is *"feat(platform): EA-2a — seed Estimating Analytics UserDashboard
preset"* and its diff includes `apps/api/prisma/seed.ts`, the exact file the prompt's premise
greps (`! grep -q "estimating-analytics" apps/api/prisma/seed.ts`). **Arming s2a today would open
a second PR for work #1920 already carries.** #1920 is currently RED (13 pass / 2 fail). When it
merges, the premise dies on its own and triage will report s2a SPENT — so this needs no repair,
only a do-not-arm note for whoever arms next. The other two ADMITs showed no overlap
(control: 2 open PRs read from the board, 3 admitted prompts scanned, 1 overlap).

**DEFERRED.** Nothing to act on: the gates are correct, the protection is intact, and the one
duplication risk resolves itself when #1920 merges. **What would make it urgent:** any of the three
ADMITs being armed while #1920 is open, or a future run reading `spent=0` *without* the SPENT
fixture control passing — that zero would be unreadable and must not be reported as clean.

🔴 **DO NOT ARM `pr-ea-s2a-dashboard-preset-seed-HOLD.md` while #1920 is open.**

## WHAT I DID NOT DO

- **Armed, disarmed, renamed, moved or staged nothing.** 04 is read-only on the board; arming is
  00's on Marco's authority. Three prompts are ADMIT and all three stay HOLD.
- **Repaired no gate.** Zero were dead, and the sweep brief forbids repairing a destructive
  prompt's gate even when it is — the two table-droppers' approval gates are the only thing lint
  rejects them on, which is the protection working.
- **Committed nothing.** `sweep-rotation.json` is left dirty for 00 by instruction.
- **Did not touch the two open PRs.** `#1923` is CLEAN and green; `#1920` is RED. Neither is
  04's to drive, and RULE 2 is not mine to evaluate or clear.
- **Did not prune the three orphaned worktrees.** `C:/PR-Master/worktrees/po-vg` holds **1
  uncommitted file** at 14,778 minutes; `git worktree remove` will refuse and `--force` would
  discard it. Worktree hygiene is Station 03's and 03 has already been dispatched on this one.
- **Did not touch the watcher clone** (`dirty=2`, not clean-on-main). Clone hygiene and any
  fast-forward there is 03's alone; 00's ABSOLUTE forbids `git merge` in it.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** The station
  doc's AUTHORITY section says take ONE named sweep and cover it completely; `next-sweep.mjs`
  named gate-liveness and a shallow pass over everything is why findings rot. The `-HOLD` corpus
  was covered whole — 36 of 36, with both instruments.
- **Did not run the adversarial prompt critique.** It runs against staged/armed prompts; armed=0,
  and the three ADMITs are unchanged since their last critique. Next rotation.
- **Did not write to `docs/qa/qa-findings.md`.** It is gitignored by its own literal line and has
  swallowed a real finding for nine days before. Findings are here, at a tracked path.
- **Did not touch `/sot/`** (05's), Azure / Entra / SharePoint (absolute hard stop, Marco only),
  or any production data.
- **Did not mint a throwaway worktree.** `origin/main` was read with `git show` / `git ls-tree`
  at a named SHA, per the superseded-2026-08-24 note in the CLEAN-TREE MANDATE.

---

**This breadcrumb is UNTRACKED in the dev tree until a board PR commits it.** Station 00 sweeps it
up together with `docs/pipeline/sweep-rotation.json`, which must land in the same PR or the
rotation stops.

Stamped `2026-09-14T14:25Z` at `origin/main` `ed3e5e42`. Every count above is STATE — re-measure,
never quote.
