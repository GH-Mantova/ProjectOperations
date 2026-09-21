# Station 00 — Supervisor | 2026-09-21T07:10:46Z–2026-09-21T07:13Z

> **BLIND RUN. STOPPED AT PREFLIGHT STEP 1.** No Windows-host shell was reachable this run.
> Nothing was armed, dispatched, merged, labelled, restarted or otherwise mutated. This is a
> **blind** "no news", not a healthy quiet one.

## GROUND

```
UTC            2026-09-21T07:10:46Z
origin/main    [CANNOT MEASURE] — no git available; see WHAT I MEASURED
dev tree       main @ 29abf8d4986a (local ref)  C:\ProjectOperations2   [read from .git/refs, NOT git]
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter — read from the WORKING COPY,
                    which PREFLIGHT §2 forbids; `git show origin/main:` was not available)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

**doc version == bootstrap (1 == 1), so no version-mismatch read-only trigger.** But that match is
**not a freshness proof** and this run could not obtain one: the station doc's own rule is to read it
from `git show origin/main:<path>` in the dev tree, and there was no shell to run git in. Treat the
instructions this run followed as *possibly superseded*.

## WHAT I MEASURED

**1. Device-bridge git guard — INSTALLED. [MEASURED]**

```
bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
→ ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
→ vm-git-guard installed at /sessions/eager-ecstatic-sagan/.local/bin/git - refuses mounted paths
  and mounted cwd, allows everything else (three controls passed)
→ persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
exit 0
```

Last line quoted verbatim, as PREFLIGHT requires. The guard is live for this session, so no `git`
could reach the Windows `.git` from the VM even by accident.

**2. Windows-host shell — UNREACHABLE. [MEASURED] This is the blindness.**

Schemas were loaded first, per PREFLIGHT's "a validation error is not blindness" rule. Four
`ToolSearch` calls were made before any conclusion was drawn:

| # | query | result |
|---|---|---|
| 1 | `desktop-commander` | `No matching deferred tools found. Some MCP servers are still connecting: plugin:desktop-commander:desktop-commander` |
| 2 | `start_process powershell terminal process` | returned unrelated tools (MS Learn, Context7) — no shell |
| 3 | `desktop-commander start process read file windows` | returned unrelated tools (Drive, Graph, GitHub, Chrome) — no shell |
| 4 | `desktop-commander` (after a 45 s wait) | still connecting |

The wait then resolved it definitively, from the harness rather than from my inference:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
"MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

A fifth search (`execute command shell powershell host machine`) confirmed **no other tool in this
session offers a host shell.** `mcp__computer-use__*` is GUI automation, and terminals/IDEs are
granted at tier "click" — typing into them is blocked — so it is not a shell substitute.

**Consequence, stated plainly:** no `gh`, no `git`, no `pipeline-lib.ps1`, no
`status-sweep.ps1`, no `bring-up-to-speed.ps1`, no `check-breadcrumb.mjs --freshness`, no
`watcher-loop-check.ps1`, no `restart-watcher-if-wedged.ps1`, no ENSURE-UP parent-chain probe, no
`arm-prompt.ps1`, no `Assert-SmokedOrEscalate` / `Merge-Pr`. Every instrument this station's job
depends on was out of reach.

**Per PREFLIGHT, GitHub-side reads were NOT substituted for the sweep, and none were made.**
`origin/main` is not the tree the watcher globs, and a GitHub read dressed up as coverage is the
exact failure the stop rule exists to prevent.

**3. What the VM mount could still see — flagged as NOT coverage. [MEASURED, plain file reads only]**

The Cowork VM mounts `C:\ProjectOperations2` read/write. That is a filesystem view, **not** the
Windows shell, and nothing below is a board verdict. It is recorded so the next sighted run starts
warmer, and every line of it needs re-measuring with real instruments.

```
.git/index.lock                → ABSENT
.git/MERGE_HEAD | REBASE_HEAD | CHERRY_PICK_HEAD
  | rebase-merge | rebase-apply | sequencer   → ALL ABSENT
.git/FETCH_HEAD mtime          → 2026-09-21 16:43:44 +1000  (≈2026-09-21T06:43Z, ~27 min before this run)
.git/refs/heads/main           → 29abf8d4986a
.git/refs/remotes/origin/main  → e02e265f38ed
docs/pr-prompts/  breadcrumbs in root: 3 · HOLD: 27 · ready: 1 · needs-marco: 60
armed prompt                   → rev-2034-ready.md, mtime 2026-09-21 17:05 +1000 (≈07:05Z, ~5 min before this run)
processed/ newest              → rev-2031-ready.md.log, rev-2030-ready.md.log
```

Two readings worth carrying forward, both **[INFERRED]** and neither safe to act on:

- **No stale lock and no half-finished merge in the dev tree.** The §9.2 freeze shape (0-byte
  `index.lock`, no owning process) is not present, and none of the wedge markers exist. So the
  specific catastrophe the guard protects against is not currently live.
- **The queue looks like it is moving, not stalled.** `rev-2034-ready.md` was armed ~5 minutes
  before this run and `rev-2030`/`rev-2031` are freshly in `processed/`. A watcher that was dead
  would not produce that shape. ⚠️ **This is an inference from file mtimes, not a heartbeat read** —
  it cannot distinguish "watcher healthy" from "watcher died 4 minutes ago", and BUSY vs WEDGED is
  exactly the distinction only `restart-watcher-if-wedged.ps1` can make.

**4. One lead the next sighted run should settle first. [MEASURED refs, direction CANNOT MEASURE]**

`refs/heads/main` (29abf8d4) ≠ `refs/remotes/origin/main` (e02e265f). Without git there is no way to
tell **behind** (routine, harmless) from **ahead** — and *ahead* is the NO-DRIFT incident this
station doc records as regenerating daily, whose every repair route is on the forbidden list. It is
recorded as a lead, not a finding, because a direction cannot be guessed.

Run first, next sighted run: `git rev-list --left-right --count HEAD...origin/main` after a fetch.

## WHAT CHANGED

**Nothing on the board, nothing in the queue, nothing in git, nothing on GitHub.** No prompt armed,
no PR merged or laboured on, no label touched, no process killed or started, no `needs-marco` file
moved, no breadcrumb archived.

Two writes, both inside this run's own scope:

1. `vm-git-guard` installed into the **VM's** `PATH` (`~/.bashrc`, `~/.profile`,
   `~/.local/bin/git`). Sandbox-side only; the Windows box was not touched.
2. This breadcrumb, written untracked to `C:\ProjectOperations2\docs\pr-prompts\`.

## FINDINGS

### F1 — Station 00's 2026-09-21T07:10Z occurrence ran BLIND: Desktop Commander CONNECT_TIMEOUT

The scheduled run fired and reached its first instruction, then found no host shell. Schemas were
loaded first and the ids were searched rather than assumed, so this is a real unreachable machine
and not the §7 instrument lie of declaring blindness off an unloaded schema. Unlike the historical
intermittent blindness of unknown cause, **this run carries a named error from the harness** —
`CONNECT_TIMEOUT … after 30000ms` on `plugin:desktop-commander:desktop-commander` — which is the
first Station 00 blind run in the record to name a cause rather than describe a symptom. Worth
carrying: the timeout is 30 s, and the server was still "connecting" 45 s in, so a slow-starting
Desktop Commander and a dead one are indistinguishable to the harness.

One cadence of supervision is lost. The board went un-driven for this occurrence: whatever was
mergeable stayed unmerged, and whatever was armed stayed unverified.

**DISPOSITION: ESCALATED** — to Marco, because the cure is outside this station's authority
(the desktop app's MCP server configuration, not the repo). The question, with options, RULE-1
ordered:

> **Station 00 ran blind at 07:10Z because the Desktop Commander MCP server timed out connecting
> (30 s). Which do you want?**
>
> **(a) Raise the Desktop Commander connect timeout and/or pre-warm the server before the station
> cadence fires.** *Complete and additive: fixes it now and for every future occurrence, adds no
> new failure mode, and touches no data.* **Passes both halves of RULE 1.** This is the
> recommendation.
>
> **(b) Give the stations a second, independent route to a host shell, so one server's timeout
> stops nothing.** Additive and durable, but **fails the "immediately" half** — it is a design
> change to `STATION-CAPABILITIES.md` and needs its own PR and review before it helps, and it
> widens the surface that can reach the box.
>
> **(c) Do nothing; treat it as the known intermittent blindness.** **Fails the "completely" half
> outright** — this run has a *named* cause, so filing it under "cause unknown" discards the one
> piece of evidence the previous blind runs never had. Costs nothing today and pays nothing either.

### F2 — A blind Station 00 cannot tell a BUSY watcher from a WEDGED one, and one prompt is armed

`rev-2034-ready.md` was armed ~5 minutes before this run. Mtimes suggest a live queue, but the whole
point of `restart-watcher-if-wedged.ps1` is that BUSY and WEDGED look identical from outside — a
prompt legitimately takes 10–40 minutes. Guessing in either direction is the failure mode: restart a
healthy agent mid-merge, or leave a wedged one for another two hours. So the answer is to wait for
an instrument, not to reason harder.

**DISPOSITION: DEFERRED** — the next Station 00 occurrence (2 h cadence) resolves it with one
command. **What would make it urgent:** if that occurrence is *also* blind, two cadences will have
passed with a prompt armed and the watcher unverified, and F1 stops being a config annoyance and
becomes a stopped board. A second consecutive blind run should be escalated to Marco immediately
rather than deferred again.

### F3 — This run could not COLLECT, so 04's and 00's 2026-09-21 breadcrumbs are still undispositioned

Three breadcrumbs sit in the queue root, none of them swept:

- `00-04-scanner-2026-09-21-0210-thirteen-of-fourteen-remote-heads-are-dead-and-three-escalations-own-the-question.md`
- `00-00-supervisor-2026-09-21-0235-addendum-collect-04s-repo-hygiene-sweep-and-consolidate-three-escalations-into-one.md`
- `00-00-supervisor-2026-09-21-0208-main-went-red-on-a-webkit-internal-error-under-a-docs-only-merge-and-the-sot-inpr-gate-is-staged.md`

COLLECT is this station's job and nobody else reads breadcrumbs, so a blind 00 means these findings
age another cadence. Their titles alone name live work — a red `main`, dead remote heads, a staged
`sot`-in-PR gate. They were **not** opened and read this run: dispositioning a finding off its
filename is the evidence-not-assertion rule broken in one step, and would be worse than leaving it.
The `needs-marco/` backlog stands at **60** files, which the station doc's own measurement says is
likely to contain dead PR-scoped escalations — also a COLLECT task, also not done.

**DISPOSITION: DEFERRED** — to the next sighted Station 00 occurrence, which must COLLECT these
three *before* it dispatches anything, per its own contract. **What would make it urgent:** the
`main`-went-red breadcrumb is 5 h old at time of writing; if `main` is still red at the next
occurrence, that finding outranks everything else on the board and should be driven before any
arming.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for the sweep.** No `gh`, no GitHub MCP call, no PR list,
  no check read. PREFLIGHT forbids presenting them as coverage, and a plausible-looking board report
  from a blind run is more dangerous than no report.
- **Did not arm `rev-2034`'s successor or any of the 27 HOLD prompts.** Arming requires LIVE gate
  verification (`requires_merged` on `origin/main`, `requires_file_on_main`) and a duplicate check
  against the merged board. Every one of those is a git or `gh` read.
- **Did not merge, label, or drive any PR.** The sanctioned path runs through `pipeline-lib.ps1`.
- **Did not touch the watcher.** No ENSURE-UP relaunch, no wedge restart. The station doc is
  explicit that `wrapper=0` is a question rather than a verdict and that a false positive starts a
  second supervisor family against a healthy machine — and this run could not even ask the question.
- **Did not clear any `[STALE]` escalation row, and did not open the 60 `needs-marco/` files.**
  Discharging requires a per-PR `gh pr view` re-ask; a LIST response's `merged` field is unusable
  (DOCTRINE §9.4), and neither was available.
- **Did not archive any breadcrumb.** Archiving is for what has been dispositioned; nothing was.
- **Did not run `git` against the mounted Windows `.git`** — the guard now refuses it, and it is a
  hard stop regardless of the guard.
- **Did not commit anything.** This breadcrumb is untracked in the dev tree.

---

**Sweep note:** this breadcrumb is **UNTRACKED** at
`docs/pr-prompts/00-00-supervisor-2026-09-21-0710-blind-run-desktop-commander-connect-timeout-no-windows-shell.md`.
`sweep-breadcrumbs.ps1` should batch it onto a branch and open one PR. It could not be written into
its own run's PR (the better home) because this run opened no PR — there was no shell to open one
with.

**`check-breadcrumb.mjs` was NOT run against this file** — it needs a shell. Do not read
`breadcrumb-clean` anywhere in this report; it is not claimed. The five required sections are
present and in the contract's order, but that is my own reading, not a validator's exit code.
